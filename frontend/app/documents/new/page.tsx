import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { NewDocument } from "@/components/NewDocument";

export const metadata: Metadata = {
  title: "New document",
};

export default function NewDocumentPage() {
  return (
    <AppShell>
      <NewDocument />
    </AppShell>
  );
}
