"""FastAPI dependencies shared by the routers, and the chat turn they all run through."""

import logging
import sqlite3
from typing import Annotated, TypeVar

from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel

from app.auth import CurrentUser
from app.db import get_conn
from app.documents.repository import DocumentRepository
from app.documents.spec import Registry
from app.llm import LlmClient, LlmError, LlmNotConfiguredError
from app.schemas import MAX_MESSAGE_LENGTH, ChatMessage

logger = logging.getLogger(__name__)

NO_RESPONSE = "The AI assistant couldn't respond. Please try again."

Turn = TypeVar("Turn", bound=BaseModel)


def get_llm(request: Request) -> LlmClient:
    return request.app.state.llm


def get_registry(request: Request) -> Registry:
    return request.app.state.registry


Llm = Annotated[LlmClient, Depends(get_llm)]
RegistryDep = Annotated[Registry, Depends(get_registry)]


def get_repository(
    user: CurrentUser,
    conn: Annotated[sqlite3.Connection, Depends(get_conn)],
    registry: RegistryDep,
) -> DocumentRepository:
    """The signed-in user's documents."""
    return DocumentRepository(conn, user.id, registry)


Repository = Annotated[DocumentRepository, Depends(get_repository)]


def ask(llm: LlmClient, system_prompt: str, messages: list[ChatMessage], model: type[Turn]) -> Turn:
    """One chat turn with the model; failures become 503 (not configured) or 502."""
    conversation = [{"role": "system", "content": system_prompt}, *(m.model_dump() for m in messages)]
    try:
        turn = llm.complete(conversation, model)
    except LlmNotConfiguredError as error:
        raise HTTPException(status_code=503, detail="The AI assistant is not configured.") from error
    except LlmError as error:
        logger.exception("Chat turn failed")
        raise HTTPException(status_code=502, detail=NO_RESPONSE) from error
    # Capped so the reply can be sent back as part of the conversation on later turns.
    turn.reply = turn.reply.strip()[:MAX_MESSAGE_LENGTH]
    if not turn.reply:
        raise HTTPException(status_code=502, detail=NO_RESPONSE)
    return turn
