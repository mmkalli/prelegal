import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import { NdaCreator } from "@/components/NdaCreator";
import { readTemplate } from "@/lib/templates";

export const metadata: Metadata = {
  title: "Mutual NDA Creator",
};

const coverPageTemplate = readTemplate("Mutual-NDA-coverpage.md");
const standardTerms = readTemplate("Mutual-NDA.md");

export default function AppPage() {
  return (
    <AuthGuard>
      <AppHeader />
      <NdaCreator coverPageTemplate={coverPageTemplate} standardTerms={standardTerms} />
    </AuthGuard>
  );
}
