import { describe, expect, it } from "vitest";
import { initialValues, readTemplate, spec } from "@/test/fixtures";
import { fillNdaCoverPage } from "./ndaCoverPage";
import type { DocumentValues } from "./types";

const template = readTemplate("Mutual-NDA-coverpage.md");
const defaults = initialValues(spec("mutual-nda"));

function nda(fields: Record<string, string> = {}, parties: Partial<DocumentValues["parties"]> = {}): DocumentValues {
  return {
    fields: {
      ...defaults.fields,
      purpose: "Exploring a joint venture.",
      effectiveDate: "2026-10-11",
      governingLaw: "Delaware",
      jurisdiction: "courts located in New Castle, DE",
      modifications: "Section 5 does not apply.",
      ...fields,
    },
    parties: {
      party1: { name: "Ada Lovelace", title: "CEO", company: "Acme Inc.", noticeAddress: "ada@acme.com" },
      party2: { name: "Alan Turing", title: "CTO", company: "Globex", noticeAddress: "alan@globex.com" },
      ...parties,
    } as DocumentValues["parties"],
  };
}

/** Removes markdown backslash escapes so assertions can use plain text. */
const unescape = (markdown: string) => markdown.replace(/\\(.)/g, "$1");

describe("fillNdaCoverPage", () => {
  it("fills every placeholder in the template", () => {
    const filled = fillNdaCoverPage(template, nda());
    expect(filled).not.toMatch(/\[Fill in|\[Today’s date\]|\[1 year\(s\)\]|List any modifications/);
    expect(filled).not.toContain("[Evaluating whether");
  });

  it("inserts the values", () => {
    const filled = unescape(fillNdaCoverPage(template, nda()));
    expect(filled).toContain("Exploring a joint venture.");
    expect(filled).toContain("October 11, 2026");
    expect(filled).toContain("Governing Law: Delaware");
    expect(filled).toContain("Jurisdiction: courts located in New Castle, DE");
    expect(filled).toContain("Section 5 does not apply.");
    expect(filled).toContain("| Print Name | Ada Lovelace | Alan Turing |");
    expect(filled).toContain("| Title | CEO | CTO |");
    expect(filled).toContain("| Company | Acme Inc. | Globex |");
    expect(filled).toMatch(/<\/label> \| ada@acme.com \| alan@globex.com \|/);
  });

  it("checks the fixed-term options with the chosen number of years", () => {
    const filled = fillNdaCoverPage(template, nda({ mndaTermYears: "2", confidentialityTermYears: "3" }));
    expect(filled).toContain("- [x]     Expires 2 years from Effective Date.");
    expect(filled).toContain("- [ ]     Continues until terminated");
    expect(filled).toContain("- [x]     3 years from Effective Date, but in the case of trade secrets");
    expect(filled).toContain("- [ ]     In perpetuity.");
  });

  it("checks the open-ended options", () => {
    const filled = fillNdaCoverPage(
      template,
      nda({ mndaTermType: "untilTerminated", confidentialityTermType: "perpetual" }),
    );
    expect(filled).toContain("- [ ]     Expires 1 year from Effective Date.");
    expect(filled).toContain("- [x]     Continues until terminated");
    expect(filled).toContain("- [ ]     1 year from Effective Date, but in the case of trade secrets");
    expect(filled).toContain("- [x]     In perpetuity.");
  });

  it("shows fill-in blanks for missing values and 'None.' for no modifications", () => {
    const filled = fillNdaCoverPage(template, defaults);
    expect(filled).toContain("Governing Law: \\_\\_\\_");
    expect(filled).toContain("None.");
    expect(filled).toContain("| Print Name |  |  |");
  });

  it("escapes markdown and HTML in values", () => {
    const filled = fillNdaCoverPage(
      template,
      nda({ governingLaw: "<script>alert(1)</script>" }, {
        party1: { name: "a | b **c**", title: "", company: "", noticeAddress: "" },
      }),
    );
    expect(filled).not.toContain("<script>");
    expect(filled).toContain("\\<script\\>");
    expect(filled).toContain("a \\| b \\*\\*c\\*\\*");
  });

  it("keeps line breaks in multi-line fields but collapses them in single-line ones", () => {
    const filled = fillNdaCoverPage(
      template,
      nda({ modifications: "First change.\n\nSecond change." }, {
        party1: { name: "", title: "", company: "", noticeAddress: "1 Main St\nSpringfield" },
      }),
    );
    expect(filled).toContain("First change\\.  \nSecond change\\.");
    expect(filled).toContain("1 Main St Springfield");
  });

  it("throws if the template no longer contains an expected placeholder", () => {
    expect(() => fillNdaCoverPage(template.replace("[Fill in state]", "[State]"), nda())).toThrow(
      /missing expected text/,
    );
  });
});
