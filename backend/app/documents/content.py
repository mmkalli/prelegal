"""The template text the frontend renders and turns into PDFs."""

import re
from functools import cache
from pathlib import Path

from app.documents.spec import DocumentSpec

# The templates write nested items ("a.", "b.", "i.") as indented plain lines, which markdown would
# merge into the preceding paragraph; a blank line makes each its own paragraph in the list item.
_NESTED_ITEM = re.compile(r"(?<=\n)(?=[ \t]+[a-z]{1,4}\.[ \t])")


def prepare_terms(markdown: str) -> str:
    markdown = markdown.replace("\r\n", "\n")
    return _NESTED_ITEM.sub("\n", markdown)


@cache
def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8").replace("\r\n", "\n")


def load_content(spec: DocumentSpec, templates_dir: Path) -> dict[str, str | None]:
    """The document's standard terms and, if it has one, its cover page template."""
    return {
        "terms": prepare_terms(_read(templates_dir / spec.terms)),
        "coverPage": _read(templates_dir / spec.coverPage) if spec.coverPage else None,
    }
