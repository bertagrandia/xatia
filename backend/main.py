import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from models import QuickLogin, Token, RoomJoin, RoomResponse
from auth import create_access_token, verify_token
from websocket import manager
from gemini import get_ai_response

load_dotenv()

app = FastAPI(title="Chat IA", version="1.0.0")

import os

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:4200").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth endpoint ─────────────────────────────────────────────────────────────

@app.post("/auth/login", response_model=Token)
async def login(body: QuickLogin):
    username = body.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
    token = create_access_token({"sub": username})
    return {"access_token": token, "token_type": "bearer"}


# ── Room endpoints ────────────────────────────────────────────────────────────

@app.post("/rooms/create", response_model=RoomResponse)
async def create_room(token: str = Query(...)):
    username = verify_token(token)
    if not username:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    room = manager.create_room(owner=username)
    return RoomResponse(room_id=room.room_id, code=room.code, role="OWNER")


@app.post("/rooms/join", response_model=RoomResponse)
async def join_room(body: RoomJoin, token: str = Query(...)):
    username = verify_token(token)
    if not username:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    room = manager.get_room_by_code(body.code)
    if not room:
        raise HTTPException(status_code=404, detail="Sala no encontrada. Verifica el código")

    if room.owner == username:
        raise HTTPException(status_code=400, detail="No puedes unirte a tu propia sala")

    if room.is_full(requesting_user=username):
        raise HTTPException(status_code=400, detail="La sala ya está llena")

    room.accepted_users.add(username)
    return RoomResponse(room_id=room.room_id, code=room.code, role="GUEST")


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_id: str,
    token: str = Query(...),
):
    username = verify_token(token)
    if not username:
        await websocket.close(code=4001, reason="Token inválido")
        return

    room = manager.get_room(room_id)
    if not room:
        await websocket.close(code=4004, reason="Sala no encontrada")
        return

    if username not in room.accepted_users:
        await websocket.close(code=4003, reason="No autorizado para esta sala")
        return

    role = "OWNER" if room.owner == username else "GUEST"
    await manager.connect(websocket, room_id, username, role)

    # Anunciar solo la primera vez que el usuario entra
    if username not in room.welcomed_users:
        room.welcomed_users.add(username)
        await manager.broadcast(room_id, {
            "type": "system",
            "content": f"✅ {username} se ha unido a la sala",
        })

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            # ── User sends a chat message ─────────────────────────────────────
            if msg_type == "user_message":
                content = data.get("content", "").strip()
                if not content:
                    continue

                await manager.broadcast(room_id, {
                    "type": "user_message",
                    "content": content,
                    "sender": username,
                })

                room.chat_history.append({"role": "user", "content": f"{username}: {content}"})

                # Cancelar respuesta pendiente y reiniciar el debounce
                if room.ai_task and not room.ai_task.done():
                    room.ai_task.cancel()

                async def respond_after_pause(r=room, rid=room_id):
                    await asyncio.sleep(2.5)
                    ai_text, tokens = await get_ai_response(
                        r.chat_history[-1]["content"], r.chat_history
                    )
                    r.chat_history.append({"role": "model", "content": ai_text})
                    await manager.broadcast(rid, {
                        "type": "ai_message",
                        "content": ai_text,
                        "tokens": tokens,
                    })

                room.ai_task = asyncio.create_task(respond_after_pause())

            # ── Usuario sale voluntariamente ──────────────────────────────────
            elif msg_type == "leave_room":
                await manager.disconnect(websocket, room_id)
                await manager.broadcast(room_id, {
                    "type": "system",
                    "content": f"👋 {username} ha abandonado la sala",
                })
                break

            # ── Owner cierra la sala ──────────────────────────────────────────
            elif msg_type == "close_room":
                current_room = manager.get_room(room_id)
                if current_room and current_room.owner == username:
                    await manager.broadcast(room_id, {
                        "type": "system",
                        "content": "🔒 El propietario ha cerrado la sala",
                    })
                    await asyncio.sleep(0.3)
                    await manager.close_all_connections(room_id)
                    manager.delete_room(room_id)
                    break

    except WebSocketDisconnect:
        # Refresh o cierre de pestaña — sin mensaje
        await manager.disconnect(websocket, room_id)
    except Exception:
        await manager.disconnect(websocket, room_id)
