from datetime import date

from fastapi import APIRouter, HTTPException, Response

from app.deps import Llm, Repository, ask
from app.documents.prompts import fill_prompt, greeting
from app.documents.repository import MAX_DOCUMENTS, ConflictError, DocumentRepository
from app.documents.turns import turn_model
from app.documents.values import apply_update, initial_values
from app.schemas import (
    MAX_HISTORY,
    ChatMessage,
    ChatTurnRequest,
    CreateDocumentRequest,
    Document,
    DocumentSummary,
)

router = APIRouter(prefix="/api/documents", tags=["documents"])


def _not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="Document not found")


def _get(repository: DocumentRepository, document_id: int) -> Document:
    document = repository.get(document_id)
    if document is None:
        raise _not_found()
    return document


@router.get("")
def list_documents(repository: Repository) -> list[DocumentSummary]:
    return repository.summaries()


@router.post("", status_code=201)
def create_document(body: CreateDocumentRequest, repository: Repository) -> Document:
    """Starts a document of the given type, continuing the conversation that chose it (if any)."""
    spec = repository.registry.get(body.documentType)
    if spec is None:
        raise HTTPException(status_code=422, detail="Unknown document type")
    if repository.count() >= MAX_DOCUMENTS:
        raise HTTPException(status_code=409, detail=f"You can keep up to {MAX_DOCUMENTS} documents.")
    messages = [*body.messages, ChatMessage(role="assistant", content=greeting(spec))]
    return repository.create(spec.slug, initial_values(spec), messages)


@router.get("/{document_id}")
def get_document(document_id: int, repository: Repository) -> Document:
    return _get(repository, document_id)


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: int, repository: Repository) -> Response:
    if not repository.delete(document_id):
        raise _not_found()
    return Response(status_code=204)


@router.post("/{document_id}/chat")
def chat(document_id: int, body: ChatTurnRequest, repository: Repository, llm: Llm) -> Document:
    """One chat turn: the assistant replies and fills in the document, and both are saved.

    Nothing is saved if the assistant fails, so the user can simply send the message again. If the
    document changed meanwhile (e.g. in another tab), the turn is rejected rather than overwriting it.
    """
    document = _get(repository, document_id)
    spec = repository.registry[document.documentType]
    messages = [*document.messages, ChatMessage(role="user", content=body.message)]

    turn = ask(llm, fill_prompt(spec, document.values, date.today()), messages[-MAX_HISTORY:], turn_model(spec))

    values = apply_update(spec, document.values, turn.updates)
    try:
        return repository.save(document, values, [*messages, ChatMessage(role="assistant", content=turn.reply)])
    except ConflictError as error:
        raise HTTPException(
            status_code=409, detail="This document was changed in another window. Reload it to continue."
        ) from error
