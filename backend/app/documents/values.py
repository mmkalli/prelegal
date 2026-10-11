"""A document's values, and how the LLM's updates are merged into them."""

from collections.abc import Callable
from datetime import date
from typing import Any

from pydantic import BaseModel, Field

from app.documents.spec import DocumentSpec, FieldSpec

MAX_TEXT_LENGTH = 2000


class Party(BaseModel):
    name: str = ""
    title: str = ""
    company: str = ""
    noticeAddress: str = ""


class DocumentValues(BaseModel):
    """Values are strings for every field kind; numbers and choices are validated on merge."""

    parties: dict[str, Party] = Field(default_factory=dict)
    fields: dict[str, str] = Field(default_factory=dict)


def initial_values(spec: DocumentSpec) -> DocumentValues:
    return DocumentValues(
        parties={party.key: Party() for party in spec.parties},
        fields={field.key: field.default for field in spec.fields},
    )


def _text(value: str, field: FieldSpec | None = None) -> str | None:
    # A blank value means "no change": the model sometimes sends "" instead of null for terms it
    # isn't changing. An optional term the user declines is recorded as "None" instead.
    return value.strip()[:MAX_TEXT_LENGTH] or None


def _date(value: str, field: FieldSpec) -> str | None:
    value = value.strip()
    try:
        return value if date.fromisoformat(value).isoformat() == value else None
    except ValueError:
        return None


def _number(value: int, field: FieldSpec) -> str:
    return str(min(field.max, max(field.min, value)))


def _choice(value: str, field: FieldSpec) -> str | None:
    return value if value in field.options else None


CLEANERS: dict[str, Callable[[Any, FieldSpec], str | None]] = {
    "text": _text,
    "longtext": _text,
    "date": _date,
    "number": _number,
    "choice": _choice,
}


def apply_update(spec: DocumentSpec, values: DocumentValues, update: BaseModel) -> DocumentValues:
    """Applies the LLM's changes (see `turn_model`): nulls are skipped and invalid values ignored."""
    fields = dict(values.fields)
    for field in spec.fields:
        value = getattr(update, field.key)
        if value is not None and (cleaned := CLEANERS[field.kind](value, field)) is not None:
            fields[field.key] = cleaned

    parties = dict(values.parties)
    for party in spec.parties:
        party_update = getattr(update.parties, party.key)
        if party_update is not None:
            changes = {key: _text(value) for key, value in party_update.model_dump(exclude_none=True).items()}
            parties[party.key] = parties[party.key].model_copy(
                update={key: value for key, value in changes.items() if value is not None}
            )
    return DocumentValues(parties=parties, fields=fields)


def document_title(spec: DocumentSpec, values: DocumentValues) -> str:
    """E.g. "Cloud Service Agreement - Acme Inc. - Globex"."""
    companies = [" ".join(values.parties[party.key].company.split()) for party in spec.parties]
    return " - ".join([spec.name, *filter(None, companies)])


def progress(spec: DocumentSpec, values: DocumentValues) -> tuple[int, int]:
    """How many of the required terms (and each party's company and signer) are filled in."""
    required = [values.fields.get(field.key, "") for field in spec.fields if not field.optional]
    for party in spec.parties:
        required += [values.parties[party.key].company, values.parties[party.key].name]
    return sum(1 for value in required if value.strip()), len(required)
