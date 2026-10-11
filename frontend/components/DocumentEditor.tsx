"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { errorText, getDocument, getDocumentContent, sendMessage } from "@/lib/api";
import { buildCoverPage } from "@/lib/coverPage";
import { pdfFileName, saveFile } from "@/lib/download";
import type { ChatMessage, DocumentContent, SavedDocument } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { ChatPanel } from "./ChatPanel";
import { DraftNotice } from "./Disclaimer";
import { DocumentView } from "./DocumentView";
import { Button, ButtonLink } from "./ui/Button";

type Loaded = { document: SavedDocument; content: DocumentContent };

function Progress({ filled, total }: { filled: number; total: number }) {
  const percent = total ? Math.round((filled / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs text-brand-gray">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-200" aria-hidden>
        <div className="h-full rounded-full bg-brand-blue transition-all" style={{ width: `${percent}%` }} />
      </div>
      {filled} of {total} key terms
    </div>
  );
}

/** Chat on the left, the live document on the right. Every turn is saved by the server. */
export function DocumentEditor({ id }: { id: number }) {
  const initial = useAsync(
    useCallback(async (): Promise<Loaded> => {
      const document = await getDocument(id);
      return { document, content: await getDocumentContent(document.documentType) };
    }, [id]),
  );
  // The document as last saved by a chat turn; until then, as loaded.
  const [saved, setSaved] = useState<SavedDocument | null>(null);
  // The message being answered, or the last one that failed: shown in the chat until saved.
  const [unsent, setUnsent] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  const document = saved ?? initial.data?.document;
  const content = initial.data?.content;
  const coverPage = useMemo(
    () => (document && content ? buildCoverPage(content, document.values) : null),
    [document, content],
  );

  if (initial.error) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-lg font-semibold text-brand-navy">We couldn&apos;t open this document</h1>
        <p className="mt-2 text-sm text-brand-gray">{initial.error}</p>
        <ButtonLink href="/documents/" variant="secondary" className="mt-6">
          Back to my documents
        </ButtonLink>
      </div>
    );
  }
  if (!document || !content || coverPage === null) {
    return (
      <p role="status" className="py-24 text-center text-sm text-brand-gray">
        Loading document…
      </p>
    );
  }

  const messages: ChatMessage[] = unsent ? [...document.messages, { role: "user", content: unsent }] : document.messages;

  const send = async (message: string) => {
    setUnsent(message);
    setPending(true);
    setChatError(null);
    try {
      setSaved(await sendMessage(document.id, message));
      setUnsent(null);
    } catch (error) {
      setChatError(errorText(error, "The assistant couldn't respond."));
    } finally {
      setPending(false);
    }
  };

  const downloadPdf = async () => {
    setDownloading(true);
    setDownloadError(false);
    try {
      // Loaded on demand: the PDF renderer is large and only needed when downloading.
      const [{ pdf }, { DocumentPdf }] = await Promise.all([import("@react-pdf/renderer"), import("./DocumentPdf")]);
      const blob = await pdf(
        <DocumentPdf title={document.title} coverPage={coverPage} standardTerms={content.terms} />,
      ).toBlob();
      saveFile(blob, pdfFileName(document.title));
    } catch (error) {
      console.error("Failed to generate the PDF", error);
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] print:block print:p-0">
      <aside className="flex h-[75vh] flex-col gap-3 print:hidden lg:sticky lg:top-6 lg:h-[calc(100vh-8.5rem)]">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand-gray">{content.spec.name}</p>
          {/* Not an <h1>: the agreement's own title in the preview is the page's main heading. */}
          <h2 className="mt-1 truncate text-lg font-semibold text-brand-navy" title={document.title}>
            {document.title}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <Progress filled={document.filled} total={document.total} />
            <span className="text-xs text-brand-gray">{pending ? "Saving…" : "All changes saved"}</span>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <ChatPanel
            messages={messages}
            pending={pending}
            error={chatError}
            onSend={(message) => void send(message)}
            onRetry={() => unsent && void send(unsent)}
          />
        </div>
      </aside>

      <main className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-neutral-500">Preview</h2>
            <span className="rounded-full bg-brand-yellow/15 px-2 py-0.5 text-xs font-semibold text-brand-yellow">
              Draft
            </span>
          </div>
          <div className="flex items-center gap-3">
            {downloadError && (
              <p role="alert" className="text-sm text-red-700">
                Couldn&apos;t create the PDF. Please try again.
              </p>
            )}
            <Button onClick={() => void downloadPdf()} loading={downloading && "Preparing PDF…"}>
              Download PDF
            </Button>
          </div>
        </div>
        <DraftNotice className="mb-3 print:hidden" />
        <div className="rounded-xl border border-neutral-200 bg-white p-8 shadow-sm sm:p-12 print:border-0 print:p-0 print:shadow-none">
          <DocumentView coverPage={coverPage} standardTerms={content.terms} />
        </div>
      </main>
    </div>
  );
}

/** The editor for the document in the query string: a static page, so /documents/edit/?id=3. */
export function DocumentEditorFromQuery() {
  const id = Number(useSearchParams().get("id"));
  return <DocumentEditor key={id} id={id} />;
}
