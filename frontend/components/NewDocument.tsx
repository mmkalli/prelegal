"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createDocument, errorText, getCatalog, selectDocument } from "@/lib/api";
import type { ChatMessage, DocumentSpec } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { ChatPanel } from "./ChatPanel";

export const SELECTION_GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi! What would you like to draft? Describe your situation, for example *“we’re about to share " +
    "our roadmap with a potential partner”*, and I’ll suggest the right agreement.",
};

/** Asks the assistant which document fits; once one is chosen, starts it with this conversation. */
function SelectionChat({
  onStart,
  starting,
}: {
  onStart: (slug: string, messages: ChatMessage[]) => Promise<void>;
  /** A document is being created: no more messages, so it can't be created twice. */
  starting: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([SELECTION_GREETING]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = async (history: ChatMessage[]) => {
    setPending(true);
    setError(null);
    try {
      const turn = await selectDocument(history);
      const conversation: ChatMessage[] = [...history, { role: "assistant", content: turn.reply }];
      setMessages(conversation);
      if (turn.documentType) await onStart(turn.documentType, conversation);
    } catch (err) {
      setError(errorText(err, "The assistant couldn't respond."));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="h-96">
      <ChatPanel
        messages={messages}
        pending={pending || starting}
        error={error}
        placeholder="Describe what you need…"
        onSend={(message) => {
          const history: ChatMessage[] = [...messages, { role: "user", content: message }];
          setMessages(history);
          void request(history);
        }}
        onRetry={() => void request(messages)}
      />
    </div>
  );
}

function DocumentCard({ spec, onStart, busy }: { spec: DocumentSpec; onStart: () => void; busy: boolean }) {
  return (
    <li>
      <button
        type="button"
        onClick={onStart}
        disabled={busy}
        className="group flex h-full w-full flex-col rounded-xl border border-neutral-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-blue/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue disabled:cursor-wait disabled:opacity-60"
      >
        <span className="font-semibold text-brand-navy group-hover:text-brand-blue">{spec.name}</span>
        <span className="mt-2 flex-1 text-sm text-brand-gray">{spec.description}</span>
        <span className="mt-4 text-sm font-medium text-brand-purple">Start drafting →</span>
      </button>
    </li>
  );
}

export function NewDocument() {
  const router = useRouter();
  const catalog = useAsync(getCatalog);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const error = startError ?? catalog.error;

  const start = async (slug: string, messages: ChatMessage[] = []) => {
    setStarting(true);
    setStartError(null);
    try {
      const document = await createDocument(slug, messages);
      router.push(`/documents/edit/?id=${document.id}`);
    } catch (err) {
      setStartError(errorText(err, "Couldn't create the document."));
      setStarting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-brand-navy">New document</h1>
      <p className="mt-1 text-sm text-brand-gray">
        Not sure which agreement you need? Ask the assistant. Or start from one of our templates.
      </p>

      {error && (
        <p role="alert" className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <section aria-labelledby="ask-heading" className="mt-8">
        <h2 id="ask-heading" className="text-sm font-semibold text-neutral-800">
          Ask the assistant
        </h2>
        <div className="mt-3">
          <SelectionChat onStart={start} starting={starting} />
        </div>
      </section>

      <section aria-labelledby="templates-heading" className="mt-12">
        <h2 id="templates-heading" className="text-sm font-semibold text-neutral-800">
          Or pick a template
        </h2>
        {!catalog.data && !error && <p className="mt-3 text-sm text-brand-gray">Loading templates…</p>}
        {catalog.data && (
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.data.map((spec) => (
              <DocumentCard key={spec.slug} spec={spec} busy={starting} onStart={() => void start(spec.slug)} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
