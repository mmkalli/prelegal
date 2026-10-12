"use client";

import Link from "next/link";
import { useState } from "react";
import { deleteDocument, errorText, getCatalog, listDocuments } from "@/lib/api";
import type { DocumentSummary } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { Button, ButtonLink } from "./ui/Button";

/** SQLite timestamps are UTC, e.g. "2026-10-11 18:02:14". */
function formatTimestamp(timestamp: string): string {
  const date = new Date(`${timestamp.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime())
    ? timestamp
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
      <div aria-hidden className="mx-auto grid size-12 place-items-center rounded-full bg-brand-blue/10 text-xl text-brand-blue">
        +
      </div>
      <h2 className="mt-4 text-base font-semibold text-brand-navy">No documents yet</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-brand-gray">
        Tell our assistant what you need, or pick a template. Your drafts are saved here as you go.
      </p>
      <ButtonLink href="/documents/new/" className="mt-6">
        Create your first document
      </ButtonLink>
    </div>
  );
}

export function DocumentList() {
  const loaded = useAsync(listDocuments);
  // Type names are a nicety (the titles already say what each document is), so failures are ignored.
  const catalog = useAsync(getCatalog);
  const [deleted, setDeleted] = useState<number[]>([]);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const documents = loaded.data?.filter((document) => !deleted.includes(document.id));
  const names = Object.fromEntries((catalog.data ?? []).map((spec) => [spec.slug, spec.name]));
  const error = deleteError ?? loaded.error;

  const remove = async (document: DocumentSummary) => {
    if (!window.confirm(`Delete “${document.title}”? This can't be undone.`)) return;
    setDeleteError(null);
    try {
      await deleteDocument(document.id);
      setDeleted((current) => [...current, document.id]);
    } catch (err) {
      setDeleteError(errorText(err, "Couldn't delete the document."));
    }
  };

  const retry = () => {
    setDeleteError(null);
    loaded.reload();
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-navy">My documents</h1>
          <p className="mt-1 text-sm text-brand-gray">Your drafts, most recently edited first.</p>
        </div>
        <ButtonLink href="/documents/new/">New document</ButtonLink>
      </div>

      {error && (
        <div role="alert" className="mt-6 flex items-center justify-between gap-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <Button variant="secondary" size="sm" onClick={retry}>
            Retry
          </Button>
        </div>
      )}

      <div className="mt-8">
        {documents === undefined && !error && (
          <ul aria-label="Loading documents" className="space-y-3">
            {[0, 1, 2].map((n) => (
              <li key={n} className="h-20 animate-pulse rounded-xl bg-neutral-200/70" />
            ))}
          </ul>
        )}
        {documents?.length === 0 && <EmptyState />}
        {documents && documents.length > 0 && (
          <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
            {documents.map((document) => (
              <li key={document.id} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-neutral-50">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/documents/edit/?id=${document.id}`}
                    className="block truncate font-medium text-brand-navy hover:text-brand-blue"
                  >
                    {document.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-brand-gray">
                    {names[document.documentType] ?? document.documentType} · Updated {formatTimestamp(document.updatedAt)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    document.filled === document.total
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-brand-yellow/15 text-neutral-700"
                  }`}
                >
                  {document.filled === document.total ? "Ready for review" : `${document.filled}/${document.total} terms`}
                </span>
                <div className="flex gap-1">
                  <ButtonLink href={`/documents/edit/?id=${document.id}`} variant="secondary" size="sm">
                    Open
                  </ButtonLink>
                  <Button variant="danger" size="sm" onClick={() => void remove(document)} aria-label={`Delete ${document.title}`}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
