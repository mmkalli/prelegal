from fastapi import APIRouter

from app.auth import CurrentUser
from app.deps import Llm, RegistryDep, ask
from app.documents.prompts import selection_prompt
from app.documents.turns import selection_model
from app.schemas import SelectRequest, SelectResponse

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/select")
def select_document(body: SelectRequest, _: CurrentUser, llm: Llm, registry: RegistryDep) -> SelectResponse:
    """A turn of the conversation that finds out which document the user needs.

    Stateless: the client sends the conversation so far; once `documentType` is set, it creates
    the document with that conversation.
    """
    turn = ask(llm, selection_prompt(registry), body.messages, selection_model(tuple(registry)))
    return SelectResponse(reply=turn.reply, documentType=turn.documentType)
