from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.nda import NdaValues

# Shared with the frontend (frontend/lib/api.ts), which sends only the most recent messages.
MAX_MESSAGE_LENGTH = 4000
MAX_HISTORY = 40


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320, pattern=r"^[^@\s]+@[^@\s]+$")
    password: str = Field(min_length=1)


class User(BaseModel):
    email: str


class Health(BaseModel):
    status: Literal["ok"]


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=MAX_HISTORY)
    values: NdaValues

    @model_validator(mode="after")
    def ends_with_user_message(self) -> "ChatRequest":
        if self.messages[-1].role != "user":
            raise ValueError("the last message must be from the user")
        return self


class ChatResponse(BaseModel):
    reply: str
    values: NdaValues
