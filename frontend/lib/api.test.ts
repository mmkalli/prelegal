import { afterEach, describe, expect, it, vi } from "vitest";
import { login } from "./api";

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
