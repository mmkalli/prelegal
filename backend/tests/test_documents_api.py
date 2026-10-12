import sqlite3

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.deps import NO_RESPONSE

from app.documents.spec import Registry
from app.llm import LlmError, LlmNotConfiguredError
from app.main import create_app
from app.schemas import MAX_HISTORY
from tests.conftest import FakeLlm, null_update, party, sign_up


def create(client: TestClient, document_type: str = "csa", messages: list | None = None) -> dict:
    response = client.post("/api/documents", json={"documentType": document_type, "messages": messages or []})
    assert response.status_code == 201, response.text
    return response.json()


def turn(registry: Registry, slug: str, reply: str = "Noted.", **fields) -> dict:
    return {"reply": reply, "updates": null_update(registry[slug], **fields)}


@pytest.mark.parametrize(
    ("method", "path"),
    [("get", "/api/documents"), ("post", "/api/documents"), ("get", "/api/documents/1"),
     ("delete", "/api/documents/1"), ("post", "/api/documents/1/chat"), ("post", "/api/chat/select")],
)
def test_requires_sign_in(client: TestClient, method: str, path: str) -> None:
    assert getattr(client, method)(path).status_code == 401


def test_create_starts_with_a_greeting_and_default_values(user_client: TestClient) -> None:
    document = create(user_client, "mutual-nda")

    assert document["documentType"] == "mutual-nda"
    assert document["title"] == "Mutual Non-Disclosure Agreement"
    assert document["values"]["fields"]["mndaTermType"] == "expires"
    assert document["values"]["parties"]["party1"] == {"name": "", "title": "", "company": "", "noticeAddress": ""}
    [message] = document["messages"]
    assert message["role"] == "assistant" and "Mutual Non-Disclosure Agreement" in message["content"]
    # Defaults fill the purpose and the four term settings; parties count company and signer.
    assert (document["filled"], document["total"]) == (5, 12)


def test_create_keeps_the_conversation_that_chose_the_document(user_client: TestClient) -> None:
    chosen = [
        {"role": "user", "content": "We want to trial our app with Globex for 3 months."},
        {"role": "assistant", "content": "A Pilot Agreement fits."},
    ]

    document = create(user_client, "pilot", chosen)

    assert document["messages"][:2] == chosen
    assert document["messages"][2]["role"] == "assistant"


def test_create_rejects_unknown_types(user_client: TestClient) -> None:
    response = user_client.post("/api/documents", json={"documentType": "lease"})

    assert response.status_code == 422


def test_chat_fills_in_and_saves_the_document(user_client: TestClient, fake_llm: FakeLlm, registry: Registry) -> None:
    document = create(user_client, "csa")
    fake_llm.responses.append(
        turn(registry, "csa", "Got it. What is the subscription period?", governingLaw="Delaware",
             parties={"provider": party(company="Acme Inc")})
    )

    response = user_client.post(f"/api/documents/{document['id']}/chat", json={"message": "Acme Inc, Delaware law"})

    assert response.status_code == 200
    saved = user_client.get(f"/api/documents/{document['id']}").json()
    assert saved == response.json()
    assert saved["title"] == "Cloud Service Agreement - Acme Inc"
    assert saved["values"]["fields"]["governingLaw"] == "Delaware"
    assert saved["values"]["parties"]["provider"]["company"] == "Acme Inc"
    assert [m["role"] for m in saved["messages"]] == ["assistant", "user", "assistant"]
    assert saved["messages"][-1]["content"] == "Got it. What is the subscription period?"
    assert saved["filled"] == 2


def test_chat_sends_the_fill_prompt_and_recent_history(
    user_client: TestClient, fake_llm: FakeLlm, registry: Registry
) -> None:
    document = create(user_client, "pilot", [{"role": "user", "content": f"m{n}"} for n in range(MAX_HISTORY)])
    fake_llm.responses.append(turn(registry, "pilot"))

    user_client.post(f"/api/documents/{document['id']}/chat", json={"message": "latest"})

    [messages] = fake_llm.requests
    assert messages[0]["role"] == "system" and "Pilot Agreement" in messages[0]["content"]
    assert len(messages) == 1 + MAX_HISTORY
    assert messages[-1] == {"role": "user", "content": "latest"}
    assert fake_llm.models[0].__name__ == "pilot_turn"


@pytest.mark.parametrize(
    ("error", "status", "detail"),
    [(LlmError("internals"), 502, NO_RESPONSE), (LlmNotConfiguredError("no key"), 503, "The AI assistant is not configured.")],
)
def test_failed_turns_save_nothing(
    user_client: TestClient, fake_llm: FakeLlm, error: Exception, status: int, detail: str
) -> None:
    document = create(user_client)
    fake_llm.responses.append(error)

    response = user_client.post(f"/api/documents/{document['id']}/chat", json={"message": "hi"})

    assert response.status_code == status
    assert response.json() == {"detail": detail}
    assert user_client.get(f"/api/documents/{document['id']}").json() == document


def test_empty_replies_fail(user_client: TestClient, fake_llm: FakeLlm, registry: Registry) -> None:
    document = create(user_client)
    fake_llm.responses.append(turn(registry, "csa", reply="  "))

    assert user_client.post(f"/api/documents/{document['id']}/chat", json={"message": "hi"}).status_code == 502


def test_list_newest_first(user_client: TestClient) -> None:
    first = create(user_client, "csa")
    second = create(user_client, "pilot")

    summaries = user_client.get("/api/documents").json()

    assert [s["id"] for s in summaries] == [second["id"], first["id"]]
    assert set(summaries[0]) == {"id", "documentType", "title", "filled", "total", "createdAt", "updatedAt"}


def test_delete(user_client: TestClient) -> None:
    document = create(user_client)

    assert user_client.delete(f"/api/documents/{document['id']}").status_code == 204
    assert user_client.get(f"/api/documents/{document['id']}").status_code == 404
    assert user_client.delete(f"/api/documents/{document['id']}").status_code == 404


def test_users_only_see_their_own_documents(client: TestClient, fake_llm: FakeLlm) -> None:
    sign_up(client, "ada@example.com")
    document = create(client)
    client.cookies.clear()
    sign_up(client, "eve@example.com")

    assert client.get("/api/documents").json() == []
    assert client.get(f"/api/documents/{document['id']}").status_code == 404
    assert client.post(f"/api/documents/{document['id']}/chat", json={"message": "hi"}).status_code == 404
    assert client.delete(f"/api/documents/{document['id']}").status_code == 404
    assert fake_llm.requests == []


def test_document_limit(user_client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.routers.documents.MAX_DOCUMENTS", 2)
    create(user_client)
    create(user_client)

    response = user_client.post("/api/documents", json={"documentType": "csa"})

    assert response.status_code == 409


@pytest.mark.parametrize("body", [{}, {"message": ""}, {"message": "x" * 4001}])
def test_chat_validates_the_message(user_client: TestClient, fake_llm: FakeLlm, body: dict) -> None:
    document = create(user_client)

    assert user_client.post(f"/api/documents/{document['id']}/chat", json=body).status_code == 422
    assert fake_llm.requests == []


def test_missing_api_key_is_503(settings: Settings) -> None:
    # The real client, built without an OPENROUTER_API_KEY.
    with TestClient(create_app(settings)) as client:
        sign_up(client)
        document = create(client)
        response = client.post(f"/api/documents/{document['id']}/chat", json={"message": "hi"})

    assert response.status_code == 503


def test_turns_on_a_changed_document_are_rejected(
    user_client: TestClient, fake_llm: FakeLlm, registry: Registry, settings: Settings
) -> None:
    document = create(user_client, "csa")

    def saved_elsewhere_meanwhile() -> dict:
        with sqlite3.connect(settings.db_path) as conn:
            conn.execute("UPDATE documents SET version = version + 1, title = 'Edited elsewhere'")
        return turn(registry, "csa", governingLaw="Delaware")

    fake_llm.responses.append(saved_elsewhere_meanwhile)

    response = user_client.post(f"/api/documents/{document['id']}/chat", json={"message": "Delaware"})

    assert response.status_code == 409
    saved = user_client.get(f"/api/documents/{document['id']}").json()
    assert saved["title"] == "Edited elsewhere"
    assert saved["values"]["fields"]["governingLaw"] == ""


def test_each_save_increases_the_version(user_client: TestClient, fake_llm: FakeLlm, registry: Registry) -> None:
    document = create(user_client)
    fake_llm.responses.append(turn(registry, "csa"))

    saved = user_client.post(f"/api/documents/{document['id']}/chat", json={"message": "hi"}).json()

    assert saved["version"] == document["version"] + 1
