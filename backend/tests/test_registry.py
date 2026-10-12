import json
import re

import pytest

from app.documents.spec import Registry, load_registry
from tests.conftest import REGISTRY_PATH, REPO, TEMPLATES_DIR

VARIABLE = re.compile(r'<span class="\w+_link"[^>]*>([^<]+)</span>')
# Party details are defined in the cover page's party table.
PARTY_DETAILS = {"Notice Address"}
RAW_SPECS = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
SLUGS = [spec["slug"] for spec in RAW_SPECS]


def normalize(name: str) -> str:
    """Matches "Customer’s" with "Customer" and "Subscription Periods" with "Subscription Period"."""
    name = name.replace("’", "'").strip().lower()
    name = name.removesuffix("'s")
    return name[:-1] if name.endswith("s") and not name.endswith("ss") else name


def template_variables(slug: str, registry: Registry) -> set[str]:
    text = (TEMPLATES_DIR / registry[slug].terms).read_text(encoding="utf-8")
    return {normalize(name) for name in VARIABLE.findall(text)}


def defined_variables(slug: str, registry: Registry) -> set[str]:
    spec = registry[slug]
    names = [party.label for party in spec.parties] + [v for f in spec.fields for v in f.template_variables]
    return {normalize(name) for name in names}


def test_covers_every_catalog_template(registry: Registry) -> None:
    catalog = json.loads((REPO / "catalog.json").read_text(encoding="utf-8"))
    used = {spec.terms for spec in registry.values()} | {spec.coverPage for spec in registry.values()}

    assert {entry["filename"].removeprefix("templates/") for entry in catalog} <= used
    assert len(registry) == 11


@pytest.mark.parametrize("slug", SLUGS)
def test_every_template_variable_is_defined(slug: str, registry: Registry) -> None:
    missing = template_variables(slug, registry) - defined_variables(slug, registry) - {
        normalize(name) for name in PARTY_DETAILS
    }

    assert not missing, f"{slug}: template variables without a party or field: {sorted(missing)}"


@pytest.mark.parametrize("slug", SLUGS)
def test_every_declared_variable_is_in_the_template(slug: str, registry: Registry) -> None:
    extra = defined_variables(slug, registry) - template_variables(slug, registry)
    # Party labels such as "Party 1" belong to the cover page, not the standard terms.
    extra -= {normalize(party.label) for party in registry[slug].parties}

    assert not extra, f"{slug}: declared variables not in the template (typo?): {sorted(extra)}"


def test_missing_template_fails_fast(tmp_path) -> None:
    registry_file = tmp_path / "documents.json"
    registry_file.write_text(json.dumps(RAW_SPECS[:1]))

    with pytest.raises(FileNotFoundError):
        load_registry(registry_file, tmp_path)


def test_invalid_specs_are_rejected(tmp_path) -> None:
    spec = json.loads(json.dumps(RAW_SPECS[0]))
    spec["fields"][0] = {"key": "years", "label": "Years", "kind": "number", "help": "no bounds"}
    registry_file = tmp_path / "documents.json"
    registry_file.write_text(json.dumps([spec]))

    with pytest.raises(ValueError):
        load_registry(registry_file, TEMPLATES_DIR)
