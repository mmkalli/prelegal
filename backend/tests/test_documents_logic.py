"""Merging LLM updates, titles, progress, the generated LLM schemas, prompts and template text."""

import json
from datetime import date

import pytest
from pydantic import ValidationError

from app.documents.content import load_content, prepare_terms
from app.documents.prompts import fill_prompt, greeting, selection_prompt
from app.documents.spec import Registry
from app.documents.turns import selection_model, turn_model
from app.documents.values import MAX_TEXT_LENGTH, Party, apply_update, document_title, initial_values, progress
from tests.conftest import TEMPLATES_DIR, null_update, party


def update(registry: Registry, slug: str, **fields):
    spec = registry[slug]
    return spec, turn_model(spec).model_validate({"reply": "ok", "updates": null_update(spec, **fields)}).updates


def test_initial_values_use_the_defaults(registry: Registry) -> None:
    values = initial_values(registry["mutual-nda"])

    assert values.fields["mndaTermType"] == "expires"
    assert values.fields["mndaTermYears"] == "1"
    assert values.fields["governingLaw"] == ""
    assert set(values.parties) == {"party1", "party2"}


def test_null_update_changes_nothing(registry: Registry) -> None:
    spec, changes = update(registry, "csa")
    values = initial_values(spec)

    assert apply_update(spec, values, changes) == values


def test_applies_fields_and_party_details(registry: Registry) -> None:
    spec, changes = update(
        registry,
        "csa",
        governingLaw=" Delaware ",
        parties={"provider": party(company="Acme Inc", name="Ada")},
    )

    values = apply_update(spec, initial_values(spec), changes)

    assert values.fields["governingLaw"] == "Delaware"
    assert values.parties["provider"] == Party(company="Acme Inc", name="Ada")
    assert values.parties["customer"] == Party()


def test_merges_party_details_individually(registry: Registry) -> None:
    spec, first = update(registry, "pilot", parties={"customer": party(company="Globex", name="Hank")})
    _, second = update(registry, "pilot", parties={"customer": party(name="", title="CEO")})

    values = apply_update(spec, apply_update(spec, initial_values(spec), first), second)

    assert values.parties["customer"] == Party(company="Globex", name="Hank", title="CEO")


@pytest.mark.parametrize(("years", "expected"), [(3, "3"), (0, "1"), (150, "99")])
def test_clamps_numbers(registry: Registry, years: int, expected: str) -> None:
    spec, changes = update(registry, "mutual-nda", mndaTermYears=years)

    assert apply_update(spec, initial_values(spec), changes).fields["mndaTermYears"] == expected


def test_choices_must_be_valid(registry: Registry) -> None:
    spec, changes = update(registry, "mutual-nda", mndaTermType="untilTerminated")
    assert apply_update(spec, initial_values(spec), changes).fields["mndaTermType"] == "untilTerminated"

    with pytest.raises(ValidationError):
        update(registry, "mutual-nda", mndaTermType="forever")


@pytest.mark.parametrize("bad_date", ["2026-02-30", "tomorrow", "2026-1-5"])
def test_ignores_invalid_dates(registry: Registry, bad_date: str) -> None:
    spec, changes = update(registry, "csa", effectiveDate=bad_date)

    assert apply_update(spec, initial_values(spec), changes).fields["effectiveDate"] == ""


def test_blank_values_never_erase_terms(registry: Registry) -> None:
    spec = registry["csa"]
    values = initial_values(spec).model_copy(
        update={"fields": initial_values(spec).fields | {"governingLaw": "Delaware", "dpa": "Provider DPA"}}
    )
    _, changes = update(registry, "csa", governingLaw="  ", dpa="", effectiveDate="")

    assert apply_update(spec, values, changes) == values


def test_declined_optional_terms_are_recorded_as_none(registry: Registry) -> None:
    spec, changes = update(registry, "csa", dpa="None")

    assert apply_update(spec, initial_values(spec), changes).fields["dpa"] == "None"


def test_truncates_long_text(registry: Registry) -> None:
    spec, changes = update(registry, "psa", deliverables="x" * 5000)

    assert apply_update(spec, initial_values(spec), changes).fields["deliverables"] == "x" * MAX_TEXT_LENGTH


def test_title_and_progress(registry: Registry) -> None:
    spec, changes = update(
        registry,
        "baa",
        agreement="CSA",
        parties={"provider": party(company="  Acme   Inc ", name="Ada")},
    )
    values = apply_update(spec, initial_values(spec), changes)

    assert document_title(spec, values) == "Business Associate Agreement - Acme Inc"
    # Required: agreement, BAA Effective Date, Breach Notification Period + 2 x (company, signer).
    assert progress(spec, values) == (3, 7)


@pytest.mark.parametrize("slug", ["mutual-nda", "csa", "psa", "dpa", "ai-addendum", "partnership"])
def test_turn_models_require_every_field_but_allow_null(registry: Registry, slug: str) -> None:
    spec = registry[slug]
    schema = turn_model(spec).model_json_schema()
    updates = schema["$defs"][f"{slug}_updates"]

    assert set(updates["required"]) == {field.key for field in spec.fields} | {"parties"}


def test_selection_model_only_accepts_known_types(registry: Registry) -> None:
    model = selection_model(tuple(registry))

    assert model.model_validate({"reply": "ok", "documentType": "csa"}).documentType == "csa"
    assert model.model_validate({"reply": "ok", "documentType": None}).documentType is None
    with pytest.raises(ValidationError):
        model.model_validate({"reply": "ok", "documentType": "lease"})


def test_selection_prompt_lists_every_document(registry: Registry) -> None:
    prompt = selection_prompt(registry)

    for spec in registry.values():
        assert f"- {spec.slug}: {spec.name}" in prompt
    assert "closest supported document" in prompt


def test_fill_prompt_describes_the_document(registry: Registry) -> None:
    spec = registry["mutual-nda"]
    values = initial_values(spec)

    prompt = fill_prompt(spec, values, date(2026, 10, 11))

    assert spec.name in prompt
    assert "Today is 2026-10-11" in prompt
    assert json.dumps(values.model_dump(), indent=2) in prompt
    assert '- mndaTermType (MNDA Term; one of: "expires", "untilTerminated")' in prompt
    assert "party1 = Party 1, party2 = Party 2" in prompt
    for field in spec.fields:
        assert f"- {field.key} (" in prompt


def test_greeting_names_the_document_and_parties(registry: Registry) -> None:
    message = greeting(registry["design-partner"])

    assert "Design Partner Agreement" in message
    assert "the Provider and the Partner" in message


def test_prepare_terms_separates_nested_items() -> None:
    terms = "1. Term.\n    1. Ends if:\n        a. a breach;\n        b. insolvency.\n"

    assert prepare_terms(terms) == "1. Term.\n    1. Ends if:\n\n        a. a breach;\n\n        b. insolvency.\n"


def test_load_content(registry: Registry) -> None:
    nda = load_content(registry["mutual-nda"], TEMPLATES_DIR)
    pilot = load_content(registry["pilot"], TEMPLATES_DIR)

    assert nda["coverPage"].startswith("# Mutual Non-Disclosure Agreement")
    assert pilot["coverPage"] is None
    assert "\r" not in pilot["terms"]
    assert "\n\n        a. if the other party fails to cure" in pilot["terms"]
