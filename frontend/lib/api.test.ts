import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_HISTORY, login, sendChat } from "./api";
import { defaultValues } from "./nda";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("login", () => {
  it("posts the credentials to the backend and returns the user", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ email: "ada@example.com" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(login("ada@example.com", "secret")).resolves.toEqual({ email: "ada@example.com" });

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "ada@example.com", password: "secret" }),
      headers: { "Content-Type": "application/json" },
    });
  });

  it("rejects when the backend responds with an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ detail: "x" }, { status: 422 })));

    await expect(login("", "")).rejects.toThrow("Request failed (422)");
  });
});

describe("sendChat", () => {
  it("posts the conversation and values and returns the turn", async () => {
    const turn = { reply: "Hi", values: defaultValues };
    const fetchMock = vi.fn().mockResolvedValue(Response.json(turn));
    vi.stubGlobal("fetch", fetchMock);
    const messages = [{ role: "user" as const, content: "Hello" }];

    await expect(sendChat(messages, defaultValues)).resolves.toEqual(turn);

    expect(fetchMock).toHaveBeenCalledWith("/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages, values: defaultValues }),
      headers: { "Content-Type": "application/json" },
    });
  });

  it("sends only the most recent messages", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ reply: "Hi", values: defaultValues }));
    vi.stubGlobal("fetch", fetchMock);
    const messages = Array.from({ length: MAX_HISTORY + 5 }, (_, n) => ({
      role: "user" as const,
      content: `message ${n}`,
    }));

    await sendChat(messages, defaultValues);

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body).messages;
    expect(sent).toEqual(messages.slice(-MAX_HISTORY));
  });
});
