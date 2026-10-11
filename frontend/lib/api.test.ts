import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "./api";

function stubFetch(...responses: Response[]) {
  const fetchMock = vi.fn();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const body = (fetchMock: ReturnType<typeof vi.fn>, call = 0) => JSON.parse(fetchMock.mock.calls[call][1].body);

afterEach(() => {
  vi.unstubAllGlobals();
  api.onUnauthorized(null);
});

describe("request errors", () => {
  it("uses FastAPI's detail as the message", async () => {
    stubFetch(Response.json({ detail: "Incorrect email or password." }, { status: 401 }));

    const error = await api.login("ada@example.com", "wrong").catch((e) => e);

    expect(error).toBeInstanceOf(api.ApiError);
    expect(error).toMatchObject({ status: 401, message: "Incorrect email or password." });
  });

  it("explains validation errors and other failures generically", async () => {
    stubFetch(Response.json({ detail: [{ msg: "x" }] }, { status: 422 }), new Response("Bad gateway", { status: 502 }));

    await expect(api.signup("a@b.co", "short")).rejects.toThrow("Please check the details you entered.");
    await expect(api.listDocuments()).rejects.toThrow("Request failed (502)");
  });

  it("reports an ended session, except for the account endpoints", async () => {
    const handler = vi.fn();
    api.onUnauthorized(handler);
    stubFetch(Response.json({ detail: "Not signed in" }, { status: 401 }), Response.json({}, { status: 401 }));

    await expect(api.listDocuments()).rejects.toThrow("Not signed in");
    expect(handler).toHaveBeenCalledTimes(1);
    await expect(api.me()).rejects.toThrow();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe("endpoints", () => {
  it("signs up with the credentials", async () => {
    const fetchMock = stubFetch(Response.json({ id: 1, email: "ada@example.com" }, { status: 201 }));

    await expect(api.signup("ada@example.com", "secret-pass")).resolves.toEqual({ id: 1, email: "ada@example.com" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/signup");
    expect(body(fetchMock)).toEqual({ email: "ada@example.com", password: "secret-pass" });
  });

  it("handles empty 204 responses", async () => {
    stubFetch(new Response(null, { status: 204 }));

    await expect(api.deleteDocument(3)).resolves.toBeUndefined();
  });

  it("sends only the most recent messages", async () => {
    const fetchMock = stubFetch(Response.json({ reply: "ok", documentType: null }), Response.json({ id: 1 }));
    const messages = Array.from({ length: api.MAX_HISTORY + 5 }, (_, n) => ({ role: "user" as const, content: `m${n}` }));

    await api.selectDocument(messages);
    await api.createDocument("csa", messages);

    expect(body(fetchMock, 0).messages).toEqual(messages.slice(-api.MAX_HISTORY));
    expect(body(fetchMock, 1)).toEqual({ documentType: "csa", messages: messages.slice(-api.MAX_HISTORY) });
  });

  it("posts a chat turn to the document", async () => {
    const fetchMock = stubFetch(Response.json({ id: 4 }));

    await api.sendMessage(4, "Delaware law");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/documents/4/chat");
    expect(body(fetchMock)).toEqual({ message: "Delaware law" });
  });

  it("caches document types, but not failures", async () => {
    const fetchMock = stubFetch(new Response("down", { status: 503 }), Response.json({ spec: {}, terms: "", coverPage: null }));

    await expect(api.getDocumentContent("baa")).rejects.toThrow();
    await api.getDocumentContent("baa");
    await api.getDocumentContent("baa");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
