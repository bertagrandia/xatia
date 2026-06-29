from pydantic import BaseModel
from enum import Enum


class QuickLogin(BaseModel):
    username: str


class Token(BaseModel):
    access_token: str
    token_type: str


class RoomJoin(BaseModel):
    code: str


class RoomResponse(BaseModel):
    room_id: str
    code: str
    role: str


class UserRole(str, Enum):
    OWNER = "OWNER"
    GUEST = "GUEST"
