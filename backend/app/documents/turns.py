"""Structured Output models for the LLM, generated from the document specs.

Every field is required but nullable (null = unchanged) and the schemas carry no constraints, which
keeps them acceptable to strict structured-output providers; values are checked when merged.
"""

from functools import cache
from typing import Any, Literal

from pydantic import BaseModel, create_model

from app.documents.spec import DocumentSpec, FieldSpec


class PartyUpdate(BaseModel):
    name: str | None
    title: str | None
    company: str | None
    noticeAddress: str | None


def _update_type(field: FieldSpec) -> Any:
    if field.kind == "number":
        return int | None
    if field.kind == "choice":
        return Literal[tuple(field.options)] | None
    return str | None


@cache
def turn_model(spec: DocumentSpec) -> type[BaseModel]:
    """{reply, updates} for one chat turn while filling in a document of this type."""
    parties = create_model(
        f"{spec.slug}_parties", **{party.key: (PartyUpdate | None, ...) for party in spec.parties}
    )
    updates = create_model(
        f"{spec.slug}_updates",
        **{field.key: (_update_type(field), ...) for field in spec.fields},
        parties=(parties, ...),
    )
    return create_model(f"{spec.slug}_turn", reply=(str, ...), updates=(updates, ...))


@cache
def selection_model(slugs: tuple[str, ...]) -> type[BaseModel]:
    """{reply, documentType} for one chat turn while choosing which document to draft."""
    return create_model("selection_turn", reply=(str, ...), documentType=(Literal[slugs] | None, ...))
