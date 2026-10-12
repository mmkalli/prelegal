import os
from datetime import date
from types import SimpleNamespace

import pytest
from litellm.exceptions import ServiceUnavailableError
from pydantic import BaseModel

from app import llm
from app.llm import LlmClient, LlmError, LlmNotConfiguredError
from app.documents.prompts import fill_prompt, selection_prompt
from app.documents.spec import Registry
from app.documents.turns import selection_model, turn_model
from app.documents.values import apply_update, initial_values


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


live = pytest.mark.skipif(not os.environ.get("OPENROUTER_API_KEY"), reason="needs OPENROUTER_API_KEY")


@pytest.mark.live
@live
@pytest.mark.parametrize(
    ("request_text", "expected"),
    [("We want to let a customer try our app for free for 3 months", "pilot"), ("I need an employment contract", None)],
)
def test_live_selection(registry: Registry, request_text: str, expected: str | None) -> None:
    """Calls the real model to check that the selection prompt and schema work end to end."""
    messages = [{"role": "system", "content": selection_prompt(registry)}, {"role": "user", "content": request_text}]

    turn = LlmClient(os.environ["OPENROUTER_API_KEY"]).complete(messages, selection_model(tuple(registry)))

    assert turn.reply.strip()
    assert turn.documentType == expected


@pytest.mark.live
@live
@pytest.mark.parametrize("slug", ["mutual-nda", "csa"])
def test_live_fill_turn(registry: Registry, slug: str) -> None:
    """Calls the real model to check that the fill prompt and generated schema work end to end."""
    spec = registry[slug]
    values = initial_values(spec)
    first, second = (party.key for party in spec.parties)
    messages = [
        {"role": "system", "content": fill_prompt(spec, values, date(2026, 10, 11))},
        {"role": "user", "content": f"{first} is Acme Inc, {second} is Globex. Delaware law. It starts on 2026-11-01."},
    ]

    turn = LlmClient(os.environ["OPENROUTER_API_KEY"]).complete(messages, turn_model(spec))
    result = apply_update(spec, values, turn.updates)

    assert turn.reply.strip()
    assert "Delaware" in result.fields["governingLaw"]
    assert result.parties[first].company == "Acme Inc"
    assert result.parties[second].company == "Globex"
    assert result.fields["effectiveDate"] == "2026-11-01"
