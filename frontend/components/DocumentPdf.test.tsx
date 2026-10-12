import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { buildCoverPage } from "@/lib/coverPage";
import { content, initialValues, SPECS } from "@/test/fixtures";
import { DocumentPdf } from "./DocumentPdf";

describe("DocumentPdf", () => {
  it.each(SPECS.map((s) => s.slug))("renders %s", async (slug) => {
    const document = content(slug);
    const coverPage = buildCoverPage(document, initialValues(document.spec));

    const buffer = await renderToBuffer(
      <DocumentPdf title={document.spec.name} coverPage={coverPage} standardTerms={document.terms} />,
    );

    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  }, 60_000);
});
