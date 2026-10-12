// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { AuthProvider } from "@/lib/auth";
import type { SavedDocument } from "@/lib/types";
import { content, initialValues, spec, SPECS } from "@/test/fixtures";
import { AppShell } from "./AppShell";
import { AuthForm } from "./AuthForm";
import { ChatPanel } from "./ChatPanel";
import { DocumentEditor } from "./DocumentEditor";
import { DocumentList } from "./DocumentList";
import { NewDocument, SELECTION_GREETING } from "./NewDocument";

const router = { replace: vi.fn(), push: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/documents/",
  useSearchParams: () => new URLSearchParams(),
}));

type Handler = (body: unknown) => Response | Promise<Response>;

/** Routes fetch calls by "METHOD /path" to handlers; records the calls. */
function mockApi(handlers: Record<string, Handler | Handler[]>) {
  const calls: { route: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
    const route = `${init?.method ?? "GET"} ${path}`;
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ route, body });
    const handler = handlers[route];
    if (!handler) return Response.json({ detail: `No mock for ${route}` }, { status: 404 });
    return (Array.isArray(handler) ? handler.shift()! : handler)(body);
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

const ME = { "GET /api/auth/me": () => Response.json({ id: 1, email: "ada@example.com" }) };
const ANONYMOUS = { "GET /api/auth/me": () => Response.json({ detail: "Not signed in" }, { status: 401 }) };

function renderWithAuth(ui: React.ReactNode) {
  return render(<AuthProvider>{ui}</AuthProvider>);
}

function savedDocument(slug: string, overrides: Partial<SavedDocument> = {}): SavedDocument {
  const documentSpec = spec(slug);
  return {
    id: 7,
    documentType: slug,
    title: documentSpec.name,
    filled: 0,
    total: 10,
    createdAt: "2026-10-11 10:00:00",
    updatedAt: "2026-10-11 10:00:00",
    values: initialValues(documentSpec),
    messages: [{ role: "assistant", content: `Let's draft your **${documentSpec.name}**.` }],
    version: 1,
    ...overrides,
  };
}

beforeEach(() => {
  router.replace.mockClear();
  router.push.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("entry and authentication", () => {
  it("sends signed-in users to their documents", async () => {
    mockApi(ME);
    renderWithAuth(<Home />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/documents/"));
  });

  it("sends visitors to the login page", async () => {
    mockApi(ANONYMOUS);
    renderWithAuth(<Home />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login/"));
  });

  it("signs in and enters the app", async () => {
    const calls = mockApi({ ...ANONYMOUS, "POST /api/auth/login": () => Response.json({ id: 1, email: "ada@example.com" }) });
    const user = userEvent.setup();
    renderWithAuth(<AuthForm mode="login" />);

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "correct horse");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/documents/"));
    expect(calls.at(-1)).toEqual({
      route: "POST /api/auth/login",
      body: { email: "ada@example.com", password: "correct horse" },
    });
  });

  it("shows why signing up failed", async () => {
    mockApi({
      ...ANONYMOUS,
      "POST /api/auth/signup": () =>
        Response.json({ detail: "Incorrect email or password." }, { status: 401 }),
    });
    const user = userEvent.setup();
    renderWithAuth(<AuthForm mode="signup" />);

    expect(screen.getByRole("heading", { name: "Create your account" })).toBeTruthy();
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "correct horse");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/couldn't create an account.*sign in instead/);
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getAllByText(/drafts and are subject to legal review/).length).toBeGreaterThan(0);
  });

  it("keeps visitors out of the app", async () => {
    mockApi(ANONYMOUS);
    renderWithAuth(<AppShell>secret page</AppShell>);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login/"));
    expect(screen.queryByText("secret page")).toBeNull();
  });

  it("shows the app with navigation, the disclaimer and sign out", async () => {
    const calls = mockApi({ ...ME, "POST /api/auth/logout": () => new Response(null, { status: 204 }) });
    const user = userEvent.setup();
    renderWithAuth(<AppShell>page content</AppShell>);

    expect(await screen.findByText("page content")).toBeTruthy();
    expect(screen.getByText("ada@example.com")).toBeTruthy();
    expect(screen.getByRole("link", { name: "My documents" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("contentinfo").textContent).toMatch(/drafts and are subject to legal review/);

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login/"));
    expect(calls.some((call) => call.route === "POST /api/auth/logout")).toBe(true);
  });

  it("returns to the login page when the session ends mid-use", async () => {
    mockApi({ ...ME, "GET /api/documents": () => Response.json({ detail: "Not signed in" }, { status: 401 }) });
    renderWithAuth(
      <AppShell>
        <DocumentList />
      </AppShell>,
    );

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login/"));
  });
});

describe("My documents", () => {
  it("shows an empty state", async () => {
    mockApi({ "GET /api/documents": () => Response.json([]), "GET /api/catalog": () => Response.json(SPECS) });
    render(<DocumentList />);

    expect(await screen.findByText("No documents yet")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Create your first document" }).getAttribute("href")).toMatch(/^\/documents\/new\/?$/);
  });

  it("lists documents and deletes one", async () => {
    const summary = { ...savedDocument("csa"), title: "Cloud Service Agreement - Acme", filled: 4, total: 15 };
    const calls = mockApi({
      "GET /api/documents": () => Response.json([summary]),
      "GET /api/catalog": () => Response.json(SPECS),
      "DELETE /api/documents/7": () => new Response(null, { status: 204 }),
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<DocumentList />);

    const link = await screen.findByRole("link", { name: "Cloud Service Agreement - Acme" });
    expect(link.getAttribute("href")).toMatch(/^\/documents\/edit\/?\?id=7$/);
    expect(screen.getByText("4/15 terms")).toBeTruthy();
    expect(screen.getByText(/Updated Oct 11, 2026/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Delete Cloud Service Agreement - Acme" }));

    await waitFor(() => expect(screen.queryByText("Cloud Service Agreement - Acme")).toBeNull());
    expect(calls.some((call) => call.route === "DELETE /api/documents/7")).toBe(true);
  });
});

describe("New document", () => {
  it("starts a document from a template card", async () => {
    const calls = mockApi({
      "GET /api/catalog": () => Response.json(SPECS),
      "POST /api/documents": () => Response.json(savedDocument("pilot", { id: 12 }), { status: 201 }),
    });
    const user = userEvent.setup();
    render(<NewDocument />);

    await user.click(await screen.findByRole("button", { name: /Pilot Agreement/ }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/documents/edit/?id=12"));
    expect(calls.at(-1)!.body).toEqual({ documentType: "pilot", messages: [] });
  });

  it("can't start a second document while one is being created", async () => {
    const calls = mockApi({
      "GET /api/catalog": () => Response.json(SPECS),
      "POST /api/documents": () => new Promise<Response>(() => {}), // never answers
    });
    const user = userEvent.setup();
    render(<NewDocument />);

    await user.click(await screen.findByRole("button", { name: /Pilot Agreement/ }));
    await user.type(screen.getByLabelText("Message"), "Actually, an NDA{Enter}");

    expect((screen.getByRole("button", { name: /Mutual Non-Disclosure Agreement/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
    expect(calls.filter((call) => call.route !== "GET /api/catalog").map((call) => call.route)).toEqual([
      "POST /api/documents",
    ]);
  });

  it("asks the assistant, offers alternatives, and starts the chosen document with the conversation", async () => {
    const calls = mockApi({
      "GET /api/catalog": () => Response.json(SPECS),
      "POST /api/chat/select": [
        () => Response.json({ reply: "We can't draft leases. A **Pilot Agreement** may help.", documentType: null }),
        () => Response.json({ reply: "Great, a Pilot Agreement.", documentType: "pilot" }),
      ],
      "POST /api/documents": () => Response.json(savedDocument("pilot", { id: 3 }), { status: 201 }),
    });
    const user = userEvent.setup();
    render(<NewDocument />);

    expect(screen.getByRole("log").textContent).toContain("What would you like to draft?");
    await user.type(screen.getByLabelText("Message"), "I need a lease{Enter}");
    expect(await screen.findByText(/We can't draft leases/)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Message"), "OK, a pilot then{Enter}");

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/documents/edit/?id=3"));
    expect(calls.find((call) => call.route === "POST /api/documents")!.body).toEqual({
      documentType: "pilot",
      messages: [
        SELECTION_GREETING,
        { role: "user", content: "I need a lease" },
        { role: "assistant", content: "We can't draft leases. A **Pilot Agreement** may help." },
        { role: "user", content: "OK, a pilot then" },
        { role: "assistant", content: "Great, a Pilot Agreement." },
      ],
    });
  });
});

describe("Document editor", () => {
  function mockEditor(chat: Handler[]) {
    const csa = content("csa");
    return mockApi({
      "GET /api/documents/7": () => Response.json(savedDocument("csa")),
      "GET /api/catalog/csa": () => Response.json(csa),
      "POST /api/documents/7/chat": chat,
    });
  }

  it("shows the conversation, the generated document and the draft notice", async () => {
    mockEditor([]);
    render(<DocumentEditor id={7} />);

    expect(within(await screen.findByRole("complementary")).getByRole("heading", { name: "Cloud Service Agreement" })).toBeTruthy();
    const document = screen.getByRole("main");
    expect(document.textContent).toContain("Key Terms");
    expect(document.textContent).toContain("Subscription Period");
    expect(within(document).getByRole("note").textContent).toMatch(/subject to legal review/);
    expect(screen.getByRole("log").textContent).toContain("Let's draft your Cloud Service Agreement.");
    expect(screen.getByText("0 of 10 key terms")).toBeTruthy();
  });

  it("sends a message and shows the saved document", async () => {
    const values = initialValues(spec("csa"));
    values.fields.governingLaw = "Delaware";
    const reply = savedDocument("csa", {
      title: "Cloud Service Agreement - Acme Inc",
      filled: 1,
      values,
      messages: [
        ...savedDocument("csa").messages,
        { role: "user", content: "Delaware law" },
        { role: "assistant", content: "Noted: Delaware." },
      ],
    });
    let respond: (response: Response) => void = () => {};
    const calls = mockEditor([() => new Promise<Response>((resolve) => (respond = resolve))]);
    const user = userEvent.setup();
    render(<DocumentEditor id={7} />);

    await user.type(await screen.findByLabelText("Message"), "Delaware law{Enter}");

    expect(screen.getByRole("log").textContent).toContain("Delaware law");
    expect(screen.getByRole("status", { name: "Assistant is typing" })).toBeTruthy();
    expect(screen.getByText("Saving…")).toBeTruthy();

    await act(async () => respond(Response.json(reply)));

    expect(await screen.findByText("Noted: Delaware.")).toBeTruthy();
    expect(within(screen.getByRole("complementary")).getByRole("heading", { name: "Cloud Service Agreement - Acme Inc" })).toBeTruthy();
    expect(screen.getByRole("main").textContent).toMatch(/Governing Law\s*Delaware/);
    expect(screen.getByText("All changes saved")).toBeTruthy();
    expect(calls.at(-1)).toEqual({ route: "POST /api/documents/7/chat", body: { message: "Delaware law" } });
  });

  it("keeps a failed message and sends it again", async () => {
    const calls = mockEditor([
      () => Response.json({ detail: "The AI assistant couldn't respond. Please try again." }, { status: 502 }),
      () => Response.json(savedDocument("csa", { messages: [{ role: "assistant", content: "Back again." }] })),
    ]);
    const user = userEvent.setup();
    render(<DocumentEditor id={7} />);

    await user.type(await screen.findByLabelText("Message"), "Delaware law{Enter}");

    expect((await screen.findByRole("alert")).textContent).toMatch(/couldn't respond/);
    expect(screen.getByRole("log").textContent).toContain("Delaware law");

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Back again.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    const chats = calls.filter((call) => call.route === "POST /api/documents/7/chat");
    expect(chats.map((call) => call.body)).toEqual([{ message: "Delaware law" }, { message: "Delaware law" }]);
  });

  it("explains when a document can't be opened", async () => {
    mockApi({ "GET /api/documents/7": () => Response.json({ detail: "Document not found" }, { status: 404 }) });
    render(<DocumentEditor id={7} />);

    expect(await screen.findByText("Document not found")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to my documents" })).toBeTruthy();
  });
});

describe("ChatPanel", () => {
  it("keeps Shift+Enter for new lines, ignores blank messages, and renders HTML as text", async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(
      <ChatPanel
        messages={[{ role: "assistant", content: "<img src=x onerror=alert(1)> **hi**" }]}
        pending={false}
        error={null}
        onSend={onSend}
        onRetry={() => {}}
      />,
    );
    const input = screen.getByLabelText("Message") as HTMLTextAreaElement;

    await user.type(input, "   {Enter}");
    await user.type(input, "line one{Shift>}{Enter}{/Shift}line two");
    expect(onSend).not.toHaveBeenCalled();
    await user.type(input, "{Enter}");

    expect(onSend).toHaveBeenCalledWith("line one\nline two");
    expect(screen.getByRole("log").querySelector("img")).toBeNull();
    expect(within(screen.getByRole("log")).getByText("hi").tagName).toBe("STRONG");
  });
});

describe("Document editor conflicts", () => {
  it("asks to reload when the document changed in another window", async () => {
    mockApi({
      "GET /api/documents/7": () => Response.json(savedDocument("csa")),
      "GET /api/catalog/csa": () => Response.json(content("csa")),
      "POST /api/documents/7/chat": () =>
        Response.json(
          { detail: "This document was changed in another window. Reload it to continue." },
          { status: 409 },
        ),
    });
    const user = userEvent.setup();
    render(<DocumentEditor id={7} />);

    await user.type(await screen.findByLabelText("Message"), "Delaware law{Enter}");

    expect((await screen.findByRole("alert")).textContent).toMatch(/changed in another window/);
  });
});
