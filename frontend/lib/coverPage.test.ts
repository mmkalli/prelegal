import { describe, expect, it } from "vitest";
import { content, initialValues, SPECS, spec } from "@/test/fixtures";
import { buildCoverPage, generateCoverPage } from "./coverPage";
import { formatDate, formatYears } from "./markdown";

const unescape = (markdown: string) => markdown.replace(/\\(.)/g, "$1");

describe("generateCoverPage", () => {
  it.each(SPECS.filter((s) => s.slug !== "mutual-nda"))("lists every key term and party of $name", (documentSpec) => {
    const markdown = generateCoverPage(documentSpec, initialValues(documentSpec));

    expect(markdown.startsWith(`# ${documentSpec.name}\n`)).toBe(true);
    for (const field of documentSpec.fields) expect(markdown).toContain(`>${field.label}</span> |`);
    for (const party of documentSpec.parties) expect(markdown).toContain(`>${party.label}</span>`);
  });

  it("shows values, blanks for missing required terms and None for missing optional ones", () => {
    const csa = spec("csa");
    const values = initialValues(csa);
    values.fields.governingLaw = "Delaware";
    values.fields.effectiveDate = "2026-11-01";
    values.parties.provider = { name: "Ada Lovelace", title: "CEO", company: "Acme Inc.", noticeAddress: "ada@acme.com" };

    const markdown = unescape(generateCoverPage(csa, values));

    expect(markdown).toContain('<span class="coverpage_link">Governing Law</span> | Delaware |');
    expect(markdown).toContain('<span class="coverpage_link">Effective Date</span> | November 1, 2026 |');
    expect(markdown).toContain('<span class="coverpage_link">Chosen Courts</span> | ____________ |');
    expect(markdown).toContain('<span class="coverpage_link">DPA</span> | None |');
    expect(markdown).toContain("| Print Name | Ada Lovelace |  |");
    expect(markdown).toContain("| Company | Acme Inc. |  |");
  });

  it("escapes markdown and HTML in values", () => {
    const pilot = spec("pilot");
    const values = initialValues(pilot);
    values.fields.product = "<img src=x onerror=alert(1)> | **bold**\nsecond line";

    const markdown = generateCoverPage(pilot, values);

    expect(markdown).not.toMatch(/(?<!\\)<img/);
    expect(markdown).toContain("\\<img src\\=x onerror\\=alert\\(1\\)\\> \\| \\*\\*bold\\*\\* second line");
  });
});

describe("buildCoverPage", () => {
  it("fills the Mutual NDA's own cover page", () => {
    const nda = content("mutual-nda");
    expect(buildCoverPage(nda, initialValues(nda.spec))).toContain("By signing this Cover Page");
    expect(buildCoverPage(nda, initialValues(nda.spec))).toContain("- [x]     Expires 1 year from Effective Date.");
  });

  it("generates the cover page of the other documents", () => {
    const dpa = content("dpa");
    expect(buildCoverPage(dpa, initialValues(dpa.spec))).toContain("## Key Terms");
  });
});

describe("formatters", () => {
  it("pluralizes years", () => {
    expect(formatYears(1)).toBe("1 year");
    expect(formatYears(5)).toBe("5 years");
  });

  it("formats ISO dates without timezone shifts and ignores invalid input", () => {
    expect(formatDate("2026-01-01")).toBe("January 1, 2026");
    expect(formatDate("")).toBe("");
    expect(formatDate("tomorrow")).toBe("");
  });
});
