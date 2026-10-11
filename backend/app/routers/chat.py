import logging
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request

from app.llm import LlmClient, LlmError, LlmNotConfiguredError
from app.nda import NdaChatTurn, apply_update, system_prompt
from app.schemas import MAX_MESSAGE_LENGTH, ChatRequest, ChatResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chat"])

NO_RESPONSE = "The AI assistant couldn't respond. Please try again."


def get_llm(request: Request) -> LlmClient:
    return request.app.state.llm


@router.post("/chat")
def chat(body: ChatRequest, llm: Annotated[LlmClient, Depends(get_llm)]) -> ChatResponse:
    """One chat turn: the assistant's reply and the agreement's values with its changes applied.

    Stateless: the client sends the recent conversation and the current values every time.
    """
    messages = [
        {"role": "system", "content": system_prompt(body.values, date.today())},
        *(message.model_dump() for message in body.messages),
    ]
    try:
        turn = llm.complete(messages, NdaChatTurn)
    except LlmNotConfiguredError as error:
        raise HTTPException(status_code=503, detail="The AI assistant is not configured.") from error
    except LlmError as error:
        logger.exception("Chat turn failed")
        raise HTTPException(status_code=502, detail=NO_RESPONSE) from error

    # Capped so the reply can be sent back as part of the conversation on the next turn.
    reply = turn.reply.strip()[:MAX_MESSAGE_LENGTH]
    if not reply:
        raise HTTPException(status_code=502, detail=NO_RESPONSE)
    return ChatResponse(reply=reply, values=apply_update(body.values, turn.updates))
