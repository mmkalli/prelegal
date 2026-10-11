// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { saveUser } from "@/lib/auth";
import { AppHeader } from "./AppHeader";
import { AuthGuard } from "./AuthGuard";
import { LoginForm } from "./LoginForm";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const storedUser = () => sessionStorage.getItem("prelegal.user");

beforeEach(() => {
  replace.mockClear();
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("Home", () => {
  it("sends visitors without a session to the login page", async () => {
    render(<Home />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login/"));
  });

  it("sends signed-in users to the platform", async () => {
    saveUser({ email: "ada@example.com" });
    render(<Home />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/app/"));
  });
});

describe("AuthGuard", () => {
  it("redirects to the login page and hides the content without a session", async () => {
    render(<AuthGuard>secret content</AuthGuard>);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login/"));
    expect(screen.queryByText("secret content")).toBeNull();
  });

  it("renders the content for a signed-in user", () => {
    saveUser({ email: "ada@example.com" });
    render(<AuthGuard>secret content</AuthGuard>);

    expect(screen.getByText("secret content")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("LoginForm", () => {
  it("signs in with the backend, stores the user and enters the platform", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ email: "ada@example.com" }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "anything");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/app/"));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(storedUser()!)).toEqual({ email: "ada@example.com" });
  });

  it("shows an error and stays on the page when the backend fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ detail: "down" }, { status: 500 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "anything");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/couldn't sign you in/i);
    expect(replace).not.toHaveBeenCalled();
    expect(storedUser()).toBeNull();
    expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("skips the form for a user who is already signed in", async () => {
    saveUser({ email: "ada@example.com" });
    render(<LoginForm />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/app/"));
  });
});

describe("AppHeader", () => {
  it("shows the user and signs them out", async () => {
    saveUser({ email: "ada@example.com" });
    const user = userEvent.setup();
    render(<AppHeader />);

    expect(screen.getByText("ada@example.com")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(storedUser()).toBeNull();
    expect(replace).toHaveBeenCalledWith("/login/");
  });
});
