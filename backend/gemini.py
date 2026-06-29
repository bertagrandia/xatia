import os
from typing import Tuple
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

SYSTEM_PROMPT = """Eres un asistente de IA útil y amigable en una sala de chat grupal.
Los mensajes tienen el formato "Nombre: mensaje", lo que indica quién habla.
Puede haber una o varias personas en la sala — dirígete a cada una por su nombre cuando sea relevante.
Responde siempre en el idioma del usuario. Sé claro, preciso y conciso."""

client = Groq(api_key=GROQ_API_KEY)


async def get_ai_response(user_message: str, chat_history: list) -> Tuple[str, int]:
    if not GROQ_API_KEY:
        return "⚠️ GROQ_API_KEY no configurada en backend/.env", 0

    try:
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        for msg in chat_history[-10:]:
            role = msg.get("role")
            if role == "model":
                role = "assistant"
            if role in ("user", "assistant"):
                messages.append({"role": role, "content": msg["content"]})

        messages.append({"role": "user", "content": user_message})

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            max_tokens=1024,
        )

        text = response.choices[0].message.content
        tokens = response.usage.total_tokens if response.usage else 0
        return text, tokens

    except Exception as e:
        return f"Error al consultar la IA: {str(e)}", 0
