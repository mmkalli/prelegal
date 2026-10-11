import { describe, expect, it } from "vitest";
import { pdfFileName } from "./download";

describe("pdfFileName", () => {
  it("uses the title without characters that filesystems reject", () => {
    expect(pdfFileName("Cloud Service Agreement - Acme Inc. - Globex")).toBe(
      "Cloud Service Agreement - Acme Inc. - Globex.pdf",
    );
    expect(pdfFileName('Pilot Agreement - A/B: "Co"? - X Corp.')).toBe("Pilot Agreement - AB Co - X Corp.pdf");
    expect(pdfFileName("...")).toBe("Document.pdf");
  });
});
