import { describe, expect, it } from "vitest";
import { defaultValues, fillCoverPage, formatDate, formatYears, parseYears, type NdaValues } from "./nda";
import { readTemplate } from "./templates";

const template = readTemplate("Mutual-NDA-coverpage.md");

const values: NdaValues = {
  ...defaultValues,
  purpose: "Exploring a joint venture.",
  effectiveDate: "2026-10-11",
  governingLaw: "Delaware",
  jurisdiction: "courts located in New Castle, DE",
  modifications: "Section 5 does not apply.",
  party1: { name: "Ada Lovelace", title: "CEO", company: "Acme Inc.", noticeAddress: "ada@acme.com" },
  party2: { name: "Alan Turing", title: "CTO", company: "Globex", noticeAddress: "alan@globex.com" },
};

/** Removes markdown backslash escapes so assertions can use plain text. */
const unescape = (markdown: string) => markdown.replace(/\\(.)/g, "$1");

describe("fillCoverPage", () => {
  it("fills every placeholder in the template", () => {
    const filled = fillCoverPage(template, values);
    expect(filled).not.toMatch(/\[Fill in|\[Today’s date\]|\[1 year\(s\)\]|List any modifications/);
    expect(filled).not.toContain("[Evaluating whether");
  });

  it("inserts the user's values", () => {
    const filled = unescape(fillCoverPage(template, values));
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
    const filled = fillCoverPage(template, {
      ...values,
      mndaTermYears: 2,
      confidentialityTermYears: 3,
    });
    expect(filled).toContain("- [x]     Expires 2 years from Effective Date.");
    expect(filled).toContain("- [ ]     Continues until terminated");
    expect(filled).toContain("- [x]     3 years from Effective Date, but in the case of trade secrets");
    expect(filled).toContain("- [ ]     In perpetuity.");
  });

  it("checks the open-ended options", () => {
    const filled = fillCoverPage(template, {
      ...values,
      mndaTermType: "untilTerminated",
      confidentialityTermType: "perpetual",
    });
    expect(filled).toContain("- [ ]     Expires 1 year from Effective Date.");
    expect(filled).toContain("- [x]     Continues until terminated");
    expect(filled).toContain("- [ ]     1 year from Effective Date, but in the case of trade secrets");
    expect(filled).toContain("- [x]     In perpetuity.");
  });

  it("shows fill-in blanks for missing values and 'None.' for no modifications", () => {
    const filled = fillCoverPage(template, defaultValues);
    expect(filled).toContain("Governing Law: \\_\\_\\_");
    expect(filled).toContain("None.");
    expect(filled).toContain("| Print Name |  |  |");
  });

  it("escapes markdown and HTML in user input", () => {
    const filled = fillCoverPage(template, {
      ...values,
      governingLaw: "<script>alert(1)</script>",
      party1: { ...values.party1, name: "a | b **c**" },
    });
    expect(filled).not.toContain("<script>");
    expect(filled).toContain("\\<script\\>");
    expect(filled).toContain("a \\| b \\*\\*c\\*\\*");
  });

  it("keeps line breaks in multi-line fields but collapses them in single-line ones", () => {
    const filled = fillCoverPage(template, {
      ...values,
      modifications: "First change.\n\nSecond change.",
      party1: { ...values.party1, noticeAddress: "1 Main St\nSpringfield" },
    });
    expect(filled).toContain("First change\\.  \nSecond change\\.");
    expect(filled).toContain("1 Main St Springfield");
  });

  it("throws if the template no longer contains an expected placeholder", () => {
    expect(() => fillCoverPage(template.replace("[Fill in state]", "[State]"), values)).toThrow(
      /missing expected text/,
    );
  });
});

describe("formatters", () => {
  it("parses years, clamping to 1-99 and rejecting non-numbers", () => {
    expect(parseYears("3")).toBe(3);
    expect(parseYears("2.7")).toBe(2);
    expect(parseYears("0")).toBe(1);
    expect(parseYears("100000")).toBe(99);
    expect(parseYears("1e21")).toBe(99);
    expect(parseYears("")).toBeNull();
    expect(parseYears("abc")).toBeNull();
  });

  it("pluralizes years", () => {
    expect(formatYears(1)).toBe("1 year");
    expect(formatYears(5)).toBe("5 years");
  });

  it("formats ISO dates without timezone shifts and ignores invalid input", () => {
    expect(formatDate("2026-01-01")).toBe("January 1, 2026");
    expect(formatDate("")).toBe("");
  });
});
