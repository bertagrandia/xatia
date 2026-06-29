import asyncio
import random
import string
import uuid
from typing import Dict, List, Optional, Set
from fastapi import WebSocket


def generate_room_code() -> str:
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=5))


class RoomMember:
    def __init__(self, websocket: WebSocket, username: str, role: str):
        self.websocket = websocket
        self.username = username
        self.role = role


class Room:
    def __init__(self, room_id: str, code: str, owner: str):
        self.room_id = room_id
        self.code = code
        self.owner = owner
        self.members: List[RoomMember] = []
        self.accepted_users: Set[str] = {owner}  # users allowed to connect
        self.welcomed_users: Set[str] = set()    # users already announced
        self.chat_history: List[dict] = []
        self.ai_task: Optional[asyncio.Task] = None

    def add_member(self, member: RoomMember) -> None:
        self.members.append(member)

    def remove_member(self, websocket: WebSocket) -> Optional[str]:
        """Removes member and returns their username, or None if not found."""
        for i, m in enumerate(self.members):
            if m.websocket is websocket:
                self.members.pop(i)
                return m.username
        return None

    def get_member(self, websocket: WebSocket) -> Optional[RoomMember]:
        return next((m for m in self.members if m.websocket is websocket), None)

    def is_empty(self) -> bool:
        return len(self.members) == 0

    def is_full(self, requesting_user: str = '') -> bool:
        """Room is full only for NEW users not already accepted."""
        if requesting_user in self.accepted_users:
            return False
        return len(self.accepted_users) >= 2


class ConnectionManager:
    def __init__(self):
        self.rooms: Dict[str, Room] = {}
        self._code_to_id: Dict[str, str] = {}

    # ── Room lifecycle ────────────────────────────────────────────────────────

    def create_room(self, owner: str) -> Room:
        room_id = str(uuid.uuid4())
        code = self._unique_code()
        room = Room(room_id, code, owner)
        self.rooms[room_id] = room
        self._code_to_id[code] = room_id
        return room

    def get_room_by_code(self, code: str) -> Optional[Room]:
        rid = self._code_to_id.get(code.upper())
        return self.rooms.get(rid) if rid else None

    def get_room(self, room_id: str) -> Optional[Room]:
        return self.rooms.get(room_id)

    def delete_room(self, room_id: str) -> None:
        room = self.rooms.pop(room_id, None)
        if room:
            self._code_to_id.pop(room.code, None)

    # ── WebSocket lifecycle ───────────────────────────────────────────────────

    async def connect(self, websocket: WebSocket, room_id: str, username: str, role: str) -> None:
        await websocket.accept()
        room = self.rooms[room_id]
        room.add_member(RoomMember(websocket, username, role))

    async def disconnect(self, websocket: WebSocket, room_id: str) -> Optional[str]:
        """Removes member and returns disconnected username. Room stays alive for reconnection."""
        room = self.rooms.get(room_id)
        if not room:
            return None
        username = room.remove_member(websocket)
        return username

    # ── Messaging ─────────────────────────────────────────────────────────────

    async def broadcast(self, room_id: str, message: dict) -> None:
        room = self.rooms.get(room_id)
        if not room:
            return
        dead: List[WebSocket] = []
        for member in list(room.members):
            try:
                await member.websocket.send_json(message)
            except Exception:
                dead.append(member.websocket)
        for ws in dead:
            room.remove_member(ws)

    async def close_all_connections(self, room_id: str) -> None:
        """Closes every WebSocket in the room (used when owner closes it)."""
        room = self.rooms.get(room_id)
        if not room:
            return
        for member in list(room.members):
            try:
                await member.websocket.close(code=1000)
            except Exception:
                pass

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _unique_code(self) -> str:
        code = generate_room_code()
        while code in self._code_to_id:
            code = generate_room_code()
        return code


manager = ConnectionManager()
