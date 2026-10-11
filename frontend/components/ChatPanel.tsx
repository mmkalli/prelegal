"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MAX_MESSAGE_LENGTH } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";
import { Button } from "./ui/Button";
import { inputClass } from "./ui/Input";

type Props = {
  messages: ChatMessage[];
  /** Waiting for the assistant's reply. */
  pending: boolean;
  /** The last message didn't get a reply; offers to send it again. */
  error: string | null;
  onSend: (message: string) => void;
  onRetry: () => void;
  placeholder?: string;
};

function Message({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="ml-10 self-end whitespace-pre-wrap rounded-2xl rounded-br-sm bg-brand-blue px-4 py-2 text-sm text-white">
        {message.content}
      </div>
    );
  }
  // Markdown without raw HTML: the model may use bold text or lists, never markup.
  return (
    <div className="prose prose-sm mr-10 self-start rounded-2xl rounded-bl-sm border border-neutral-200 bg-white px-4 py-2 text-neutral-900 shadow-sm prose-p:my-1 prose-ul:my-1 prose-ol:my-1">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div
      role="status"
      aria-label="Assistant is typing"
      className="flex gap-1 self-start rounded-2xl rounded-bl-sm border border-neutral-200 bg-white px-4 py-3 shadow-sm"
    >
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-1.5 animate-bounce rounded-full bg-brand-gray"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

/** A conversation with the AI assistant: the messages and a box to write the next one. */
export function ChatPanel({ messages, pending, error, onSend, onRetry, placeholder = "Type your answer…" }: Props) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages, pending, error]);

  const send = () => {
    const content = draft.trim();
    if (!content || pending) return;
    setDraft("");
    onSend(content);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
      <div role="log" aria-label="Conversation" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.map((message, index) => (
          <Message key={index} message={message} />
        ))}
        {pending && <TypingIndicator />}
        {error && (
          <div role="alert" className="flex flex-wrap items-center gap-x-3 self-start text-sm text-red-700">
            {error}
            <button type="button" onClick={onRetry} className="font-medium underline hover:no-underline">
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
        className="flex items-end gap-2 border-t border-neutral-200 bg-white p-3"
      >
        <textarea
          aria-label="Message"
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder={placeholder}
          className={`${inputClass} min-h-0 flex-1 resize-none`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button type="submit" disabled={pending || !draft.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
