// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultValues, type NdaValues } from "@/lib/nda";
import { readTemplate } from "@/lib/templates";
import { ChatPanel, GREETING } from "./ChatPanel";
import { NdaCreator } from "./NdaCreator";

const updatedValues: NdaValues = { ...defaultValues, governingLaw: "Delaware" };

function stubFetch(...responses: Response[]) {
  const fetchMock = vi.fn();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** A fetch whose response arrives only when `resolve` is called. */
function deferredFetch() {
  let resolve: (response: Response) => void = () => {};
  const fetchMock = vi.fn(() => new Promise<Response>((r) => (resolve = r)));
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, resolve: (response: Response) => resolve(response) };
}

function sentBody(fetchMock: ReturnType<typeof vi.fn>, call = 0) {
  return JSON.parse(fetchMock.mock.calls[call][1].body);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ChatPanel", () => {
  it("opens with the assistant's greeting", () => {
    render(<ChatPanel values={defaultValues} onValuesChange={() => {}} />);

    expect(screen.getByRole("log").textContent).toContain(GREETING.content);
  });

  it("sends the conversation and current values, then shows the reply and new values", async () => {
    const fetchMock = stubFetch(Response.json({ reply: "Great, **Delaware** it is.", values: updatedValues }));
    const onValuesChange = vi.fn();
    const user = userEvent.setup();
    render(<ChatPanel values={defaultValues} onValuesChange={onValuesChange} />);

    await user.type(screen.getByLabelText("Message"), "Delaware law please{Enter}");

    const log = screen.getByRole("log");
    await waitFor(() => expect(log.textContent).toContain("Great, Delaware it is."));
    expect(within(log).getByText("Delaware").tagName).toBe("STRONG");
    expect(onValuesChange).toHaveBeenCalledWith(updatedValues);
    expect(fetchMock).toHaveBeenCalledWith("/api/chat", expect.objectContaining({ method: "POST" }));
    expect(sentBody(fetchMock)).toEqual({
      messages: [GREETING, { role: "user", content: "Delaware law please" }],
      values: defaultValues,
    });
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toBe("");
  });

  it("shows a typing indicator and blocks sending while waiting for the reply", async () => {
    const { fetchMock, resolve } = deferredFetch();
    const user = userEvent.setup();
    render(<ChatPanel values={defaultValues} onValuesChange={() => {}} />);

    await user.type(screen.getByLabelText("Message"), "Hello{Enter}");

    expect(screen.getByRole("status", { name: "Assistant is typing" })).toBeTruthy();
    expect(screen.getByRole("log").textContent).toContain("Hello");
    await user.type(screen.getByLabelText("Message"), "Again{Enter}");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);

    resolve(Response.json({ reply: "Hi there", values: defaultValues }));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(screen.getByRole("log").textContent).toContain("Hi there");
  });

  it("keeps Shift+Enter for new lines and ignores blank messages", async () => {
    const fetchMock = stubFetch();
    const user = userEvent.setup();
    render(<ChatPanel values={defaultValues} onValuesChange={() => {}} />);
    const input = screen.getByLabelText("Message") as HTMLTextAreaElement;

    await user.type(input, "   {Enter}");
    await user.type(input, "line one{Shift>}{Enter}{/Shift}line two");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(input.value).toBe("   line one\nline two");
  });

  it("shows an error when the assistant fails and retries the same conversation", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = stubFetch(
      Response.json({ detail: "down" }, { status: 502 }),
      Response.json({ reply: "Back online", values: updatedValues }),
    );
    const onValuesChange = vi.fn();
    const user = userEvent.setup();
    render(<ChatPanel values={defaultValues} onValuesChange={onValuesChange} />);

    await user.type(screen.getByLabelText("Message"), "Delaware{Enter}");

    expect((await screen.findByRole("alert")).textContent).toMatch(/couldn't respond/);
    expect(onValuesChange).not.toHaveBeenCalled();
    expect(screen.getByRole("log").textContent).toContain("Delaware");

    await user.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(screen.getByRole("log").textContent).toContain("Back online"));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(sentBody(fetchMock, 1)).toEqual(sentBody(fetchMock, 0));
    expect(onValuesChange).toHaveBeenCalledWith(updatedValues);
  });

  it("renders the assistant's HTML as text, not markup", async () => {
    stubFetch(Response.json({ reply: "<img src=x onerror=alert(1)> hi", values: defaultValues }));
    const user = userEvent.setup();
    render(<ChatPanel values={defaultValues} onValuesChange={() => {}} />);

    await user.type(screen.getByLabelText("Message"), "Hello{Enter}");

    await waitFor(() => expect(screen.getByRole("log").textContent).toContain("hi"));
    expect(screen.getByRole("log").querySelector("img")).toBeNull();
  });
});

describe("NdaCreator", () => {
  it("fills the agreement preview from the chat", async () => {
    stubFetch(Response.json({ reply: "Noted.", values: updatedValues }));
    const user = userEvent.setup();
    render(<NdaCreator coverPageTemplate={readTemplate("Mutual-NDA-coverpage.md")} standardTerms="" />);

    await user.type(screen.getByLabelText("Message"), "Delaware law{Enter}");

    await waitFor(() => expect(screen.getByRole("main").textContent).toContain("Governing Law: Delaware"));
  });
});
