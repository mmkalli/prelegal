import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { DocumentEditorFromQuery } from "@/components/DocumentEditor";

export const metadata: Metadata = {
  title: "Edit document",
};

export default function EditDocumentPage() {
  return (
    <AppShell>
      {/* Reading the query string needs a Suspense boundary in a static export. */}
      <Suspense>
        <DocumentEditorFromQuery />
      </Suspense>
    </AppShell>
  );
}
