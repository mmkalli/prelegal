import os
from datetime import date
from types import SimpleNamespace

import pytest
from litellm.exceptions import ServiceUnavailableError
from pydantic import BaseModel

from app import llm
from app.llm import LlmClient, LlmError, LlmNotConfiguredError
from app.nda import NdaChatTurn, apply_update, system_prompt
from tests.test_nda import make_values


class Answer(BaseModel):
    city: str


def fake_completion(content: str | None, calls: list[dict]):
    def completion(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])

    return completion


def test_calls_openrouter_with_cerebras_and_structured_output(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict] = []
    monkeypatch.setattr(llm, "completion", fake_completion('{"city": "Paris"}', calls))
    messages = [{"role": "user", "content": "I live in Paris"}]

    result = LlmClient("key").complete(messages, Answer)

    assert result == Answer(city="Paris")
    [kwargs] = calls
    assert kwargs["model"] == "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
    assert kwargs["extra_body"] == {"provider": {"order": ["cerebras"]}}
    assert kwargs["reasoning_effort"] == "low"
    assert kwargs["response_format"] is Answer
    assert kwargs["messages"] == messages
    assert kwargs["api_key"] == "key"


@pytest.mark.parametrize("content", ["not json", '{"town": "Paris"}', None])
def test_unusable_responses_raise_llm_error(monkeypatch: pytest.MonkeyPatch, content: str | None) -> None:
    monkeypatch.setattr(llm, "completion", fake_completion(content, []))

    with pytest.raises(LlmError):
        LlmClient("key").complete([], Answer)


def overloaded() -> ServiceUnavailableError:
    return ServiceUnavailableError("Service temporarily overloaded", llm_provider="openrouter", model="m")


def flaky_completion(errors: list[Exception], calls: list[dict]):
    succeed = fake_completion('{"city": "Paris"}', calls)

    def completion(**kwargs):
        if errors:
            calls.append(kwargs)
            raise errors.pop(0)
        return succeed(**kwargs)

    return completion


def test_retries_transient_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict] = []
    monkeypatch.setattr(llm, "completion", flaky_completion([overloaded(), overloaded()], calls))
    monkeypatch.setattr(llm, "sleep", lambda seconds: None)

    assert LlmClient("key").complete([], Answer) == Answer(city="Paris")
    assert len(calls) == 3


def test_gives_up_after_the_retries(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict] = []
    monkeypatch.setattr(llm, "completion", flaky_completion([overloaded()] * 3, calls))
    monkeypatch.setattr(llm, "sleep", lambda seconds: None)

    with pytest.raises(LlmError):
        LlmClient("key").complete([], Answer)
    assert len(calls) == 3


def test_does_not_retry_other_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict] = []
    monkeypatch.setattr(llm, "completion", flaky_completion([TimeoutError("timed out")], calls))

    with pytest.raises(LlmError):
        LlmClient("key").complete([], Answer)
    assert len(calls) == 1


def test_missing_api_key_skips_the_call(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict] = []
    monkeypatch.setattr(llm, "completion", fake_completion("{}", calls))

    with pytest.raises(LlmNotConfiguredError):
        LlmClient(None).complete([], Answer)
    assert calls == []


@pytest.mark.live
@pytest.mark.skipif(not os.environ.get("OPENROUTER_API_KEY"), reason="needs OPENROUTER_API_KEY")
def test_live_nda_turn() -> None:
    """Calls the real model to check that the prompt and schema work end to end."""
    values = make_values()
    messages = [
        {"role": "system", "content": system_prompt(values, date(2026, 10, 11))},
        {"role": "user", "content": "We are Acme Inc and Globex; Delaware law; it should last 2 years."},
    ]

    turn = LlmClient(os.environ["OPENROUTER_API_KEY"]).complete(messages, NdaChatTurn)
    result = apply_update(values, turn.updates)

    assert turn.reply.strip()
    assert "Delaware" in result.governingLaw
    assert {result.party1.company, result.party2.company} == {"Acme Inc", "Globex"}
    assert result.mndaTermType == "expires"
    assert result.mndaTermYears == 2
