// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { clearUser, saveUser, useUser } from "./auth";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe("useUser", () => {
  it("has no user by default", () => {
    const { result } = renderHook(() => useUser());
    expect(result.current).toBeNull();
  });

  it("follows sign in and sign out", () => {
    const { result } = renderHook(() => useUser());

    act(() => saveUser({ email: "ada@example.com" }));
    expect(result.current).toEqual({ email: "ada@example.com" });
    expect(JSON.parse(sessionStorage.getItem("prelegal.user")!)).toEqual({ email: "ada@example.com" });

    act(() => clearUser());
    expect(result.current).toBeNull();
    expect(sessionStorage.getItem("prelegal.user")).toBeNull();
  });

  it("restores the user saved earlier in the tab", () => {
    saveUser({ email: "ada@example.com" });
    const { result } = renderHook(() => useUser());
    expect(result.current).toEqual({ email: "ada@example.com" });
  });

  it.each(["not json", JSON.stringify({ name: "no email" })])("ignores malformed stored value %s", (raw) => {
    sessionStorage.setItem("prelegal.user", raw);
    const { result } = renderHook(() => useUser());
    expect(result.current).toBeNull();
  });
});
