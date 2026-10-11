import json
from datetime import date

import pytest
from pydantic import ValidationError

from app.nda import (
    MAX_TEXT_LENGTH,
    MAX_YEARS,
    MIN_YEARS,
    NdaUpdate,
    NdaValues,
    Party,
    PartyUpdate,
    apply_update,
    system_prompt,
)


def make_values(**overrides: object) -> NdaValues:
    empty = {"name": "", "title": "", "company": "", "noticeAddress": ""}
    values = {
        "purpose": "Evaluating a partnership.",
        "effectiveDate": "",
        "mndaTermType": "expires",
        "mndaTermYears": 1,
        "confidentialityTermType": "years",
        "confidentialityTermYears": 1,
        "governingLaw": "",
        "jurisdiction": "",
        "modifications": "",
        "party1": empty,
        "party2": empty,
    }
    return NdaValues.model_validate(values | overrides)


def make_update(**fields: object) -> NdaUpdate:
    return NdaUpdate.model_validate({key: None for key in NdaUpdate.model_fields} | fields)


def party_update(**fields: str) -> PartyUpdate:
    return PartyUpdate.model_validate({key: None for key in PartyUpdate.model_fields} | fields)


def test_null_update_changes_nothing() -> None:
    values = make_values(governingLaw="Delaware")

    assert apply_update(values, make_update()) == values


def test_applies_only_the_given_fields() -> None:
    values = make_values(governingLaw="Delaware")

    result = apply_update(
        values,
        make_update(jurisdiction="courts located in New Castle, DE", mndaTermType="untilTerminated"),
    )

    assert result.jurisdiction == "courts located in New Castle, DE"
    assert result.mndaTermType == "untilTerminated"
    assert result.governingLaw == "Delaware"
    assert result.purpose == values.purpose


def test_merges_party_fields_individually() -> None:
    values = make_values(party1={"name": "Ada", "title": "CEO", "company": "Acme", "noticeAddress": ""})

    result = apply_update(values, make_update(party1=party_update(noticeAddress="ada@acme.com")))

    assert result.party1 == Party(name="Ada", title="CEO", company="Acme", noticeAddress="ada@acme.com")
    assert result.party2 == values.party2


@pytest.mark.parametrize(("years", "expected"), [(3, 3), (0, MIN_YEARS), (-5, MIN_YEARS), (150, MAX_YEARS)])
def test_clamps_years(years: int, expected: int) -> None:
    result = apply_update(make_values(), make_update(mndaTermYears=years, confidentialityTermYears=years))

    assert result.mndaTermYears == expected
    assert result.confidentialityTermYears == expected


@pytest.mark.parametrize("bad_date", ["2026-02-30", "tomorrow", "12/10/2026", "2026-1-5"])
def test_ignores_invalid_dates(bad_date: str) -> None:
    values = make_values(effectiveDate="2026-10-11")

    assert apply_update(values, make_update(effectiveDate=bad_date)).effectiveDate == "2026-10-11"


def test_accepts_valid_dates() -> None:
    assert apply_update(make_values(), make_update(effectiveDate=" 2026-10-12 ")).effectiveDate == "2026-10-12"


def test_trims_and_truncates_text() -> None:
    result = apply_update(make_values(), make_update(purpose="  " + "x" * 5000 + "  ", modifications="  "))

    assert result.purpose == "x" * MAX_TEXT_LENGTH
    assert result.modifications == ""


def test_ignores_blank_values_except_modifications() -> None:
    values = make_values(
        governingLaw="Delaware",
        modifications="None of section 5.",
        party1={"name": "Ada", "title": "", "company": "Acme", "noticeAddress": ""},
    )

    result = apply_update(
        values, make_update(governingLaw="  ", modifications="", party1=party_update(name="", title="CEO"))
    )

    assert result.governingLaw == "Delaware"
    assert result.modifications == ""
    assert result.party1 == Party(name="Ada", title="CEO", company="Acme", noticeAddress="")


def test_values_reject_out_of_range_input() -> None:
    with pytest.raises(ValidationError):
        make_values(mndaTermYears=0)
    with pytest.raises(ValidationError):
        make_values(effectiveDate="soon")
    with pytest.raises(ValidationError):
        make_values(mndaTermType="forever")


def test_system_prompt_includes_date_values_and_rules() -> None:
    values = make_values(governingLaw="Delaware")

    prompt = system_prompt(values, date(2026, 10, 11))

    assert "Today is 2026-10-11" in prompt
    assert json.dumps(values.model_dump(), indent=2) in prompt
    assert "Reply in the language the user writes in" in prompt
    assert "write every value in English" in prompt
    for field in NdaValues.model_fields:
        assert field in prompt
