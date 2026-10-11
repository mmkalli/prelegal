from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.documents.spec import DocumentSpec
from app.documents.values import DocumentValues

# Shared with the frontend (frontend/lib/api.ts).
MAX_MESSAGE_LENGTH = 4000
# Only the most recent messages are sent to the model; the current values carry the rest.
MAX_HISTORY = 40
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128  # scrypt cost grows with the input, so it is capped


def _encodable(text: str) -> str:
    """Rejects text that can't be encoded as UTF-8 (lone surrogates are valid JSON but not UTF-8)."""
    try:
        text.encode()
    except UnicodeEncodeError as error:
        raise ValueError("must be valid text") from error
    return text


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=320, pattern=r"^\s*[^@\s]+@[^@\s]+\s*$")
    password: str = Field(min_length=1, max_length=MAX_PASSWORD_LENGTH)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, email: str) -> str:
        return _encodable(email).strip().lower()

    @field_validator("password")
    @classmethod
    def check_password(cls, password: str) -> str:
        return _encodable(password)


class SignupRequest(Credentials):
    password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_LENGTH)


class User(BaseModel):
    id: int
    email: str


class Health(BaseModel):
    status: Literal["ok"]


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)


class SelectRequest(BaseModel):
    """A turn of the conversation that picks which document to draft (no document exists yet)."""

    messages: list[ChatMessage] = Field(min_length=1, max_length=MAX_HISTORY)

    @model_validator(mode="after")
    def ends_with_user_message(self) -> "SelectRequest":
        if self.messages[-1].role != "user":
            raise ValueError("the last message must be from the user")
        return self


class SelectResponse(BaseModel):
    reply: str
    documentType: str | None


class DocumentContent(BaseModel):
    """A document type with the template text it is rendered from."""

    spec: DocumentSpec
    terms: str
    # The template of a document with a hand-made cover page (the Mutual NDA); otherwise generated.
    coverPage: str | None


class CreateDocumentRequest(BaseModel):
    documentType: str
    # The conversation so far (e.g. from choosing the document), kept as the document's history.
    messages: list[ChatMessage] = Field(default_factory=list, max_length=MAX_HISTORY)


class ChatTurnRequest(BaseModel):
    message: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)


class DocumentSummary(BaseModel):
    id: int
    documentType: str
    title: str
    filled: int
    total: int
    createdAt: str
    updatedAt: str


class Document(DocumentSummary):
    values: DocumentValues
    messages: list[ChatMessage]
    # Increases with every save; a save based on an older version is rejected.
    version: int
