"""The document types Prelegal can draft, loaded from documents.json at the repo root.

Each spec lists the parties and the key terms of one Common Paper template. The key terms are the
template's variables (`<span class="..._link">Name</span>`), which our generated cover page defines;
tests check that every variable in each template is covered by a party or a field.
"""

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, model_validator

FieldKind = Literal["text", "longtext", "date", "number", "choice"]


class FieldSpec(BaseModel):
    key: str
    label: str
    kind: FieldKind
    help: str
    optional: bool = False
    default: str = ""
    min: int | None = None
    max: int | None = None
    options: list[str] | None = None
    # Template variables this field defines; None means just the label, [] means cover page only.
    variables: list[str] | None = None

    @model_validator(mode="after")
    def check_kind(self) -> "FieldSpec":
        if self.kind == "number" and (self.min is None or self.max is None):
            raise ValueError(f"number field {self.key} needs min and max")
        if self.kind == "choice" and not self.options:
            raise ValueError(f"choice field {self.key} needs options")
        return self

    @property
    def template_variables(self) -> list[str]:
        return [self.label] if self.variables is None else self.variables


class PartySpec(BaseModel):
    key: str
    label: str


class DocumentSpec(BaseModel):
    slug: str
    name: str
    description: str
    terms: str
    coverPage: str | None = None
    parties: list[PartySpec]
    fields: list[FieldSpec]

    @model_validator(mode="after")
    def check_unique_keys(self) -> "DocumentSpec":
        for things in (self.fields, self.parties):
            keys = [thing.key for thing in things]
            if len(keys) != len(set(keys)):
                raise ValueError(f"{self.slug} has duplicate keys")
        return self

    def __hash__(self) -> int:
        # Specs are loaded once and never change, so they can key caches (see turns.py).
        return hash(self.slug)


Registry = dict[str, DocumentSpec]


def load_registry(path: Path, templates_dir: Path) -> Registry:
    """Loads and checks the document specs, failing fast if a template file is missing."""
    specs = [DocumentSpec.model_validate(item) for item in json.loads(path.read_text(encoding="utf-8"))]
    for spec in specs:
        for filename in filter(None, (spec.terms, spec.coverPage)):
            if not (templates_dir / filename).is_file():
                raise FileNotFoundError(f"{spec.slug}: template {filename} not found in {templates_dir}")
    return {spec.slug: spec for spec in specs}
