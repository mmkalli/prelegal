"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MAX_MESSAGE_LENGTH, sendChat, type ChatMessage } from "@/lib/api";
import type { NdaValues } from "@/lib/nda";

type Props = {
  values: NdaValues;
  onValuesChange: (values: NdaValues) => void;
};

// Static, so the conversation opens instantly without a model call.
export const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I'll help you draft a Mutual NDA. To start: which two companies are entering into the " +
    "agreement, and why will they share confidential information?",
};

function Message({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="ml-8 self-end whitespace-pre-wrap rounded-lg bg-brand-blue px-3 py-2 text-sm text-white">
        {message.content}
      </div>
    );
  }
  // Markdown without raw HTML: the model may use bold text or lists, never markup.
  return (
    <div className="prose prose-sm mr-8 self-start rounded-lg bg-white px-3 py-2 text-neutral-900 shadow-sm prose-p:my-1 prose-ul:my-1">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
    </div>
  );
}

/** Freeform chat with the AI assistant, which fills in the agreement as the user answers. */
export function ChatPanel({ values, onValuesChange }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages, pending, failed]);

  const request = async (history: ChatMessage[]) => {
    setPending(true);
    setFailed(false);
    try {
      const turn = await sendChat(history, values);
      setMessages([...history, { role: "assistant", content: turn.reply }]);
      onValuesChange(turn.values);
    } catch (error) {
      console.error("Chat request failed", error);
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  const send = () => {
    const content = draft.trim();
    if (!content || pending) return;
    const history: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(history);
    setDraft("");
    void request(history);
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-neutral-200 bg-neutral-50">
      <div role="log" aria-label="Conversation" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.map((message, index) => (
          <Message key={index} message={message} />
        ))}
        {pending && (
          <div role="status" aria-label="Assistant is typing" className="flex gap-1 self-start rounded-lg bg-white px-3 py-3 shadow-sm">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="size-1.5 animate-bounce rounded-full bg-brand-gray"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        )}
        {failed && (
          <div role="alert" className="flex items-center gap-3 self-start text-sm text-red-700">
            The assistant couldn&apos;t respond.
            <button
              type="button"
              onClick={() => void request(messages)}
              className="font-medium underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-end gap-2 border-t border-neutral-200 p-3"
      >
        <textarea
          aria-label="Message"
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Type your answer…"
          className="min-h-0 flex-1 resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          className="rounded-md bg-brand-purple px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-purple/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </div>
  );
}
