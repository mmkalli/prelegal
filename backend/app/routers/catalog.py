from fastapi import APIRouter, HTTPException, Request

from app.deps import RegistryDep
from app.documents.content import load_content
from app.documents.spec import DocumentSpec
from app.schemas import DocumentContent

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


@router.get("")
def list_document_types(registry: RegistryDep) -> list[DocumentSpec]:
    return list(registry.values())


@router.get("/{slug}")
def get_document_type(slug: str, registry: RegistryDep, request: Request) -> DocumentContent:
    """The document type with the template text it is rendered from."""
    spec = registry.get(slug)
    if spec is None:
        raise HTTPException(status_code=404, detail="Unknown document type")
    return DocumentContent(spec=spec, **load_content(spec, request.app.state.settings.templates_dir))
