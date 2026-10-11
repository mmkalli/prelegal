// Fills the Common Paper Mutual NDA cover page template with user-entered values.
// The Standard Terms are used verbatim: they refer to the Cover Page's values by name.

export type Party = {
  name: string;
  title: string;
  company: string;
  noticeAddress: string;
};

export type NdaValues = {
  purpose: string;
  /** ISO date (YYYY-MM-DD), or empty if not chosen yet. */
  effectiveDate: string;
  mndaTermType: "expires" | "untilTerminated";
  mndaTermYears: number;
  confidentialityTermType: "years" | "perpetual";
  confidentialityTermYears: number;
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  party1: Party;
  party2: Party;
};

const emptyParty: Party = { name: "", title: "", company: "", noticeAddress: "" };

export const defaultValues: NdaValues = {
  purpose: "Evaluating whether to enter into a business relationship with the other party.",
  effectiveDate: "",
  mndaTermType: "expires",
  mndaTermYears: 1,
  confidentialityTermType: "years",
  confidentialityTermYears: 1,
  governingLaw: "",
  jurisdiction: "",
  modifications: "",
  party1: { ...emptyParty },
  party2: { ...emptyParty },
};

/** Shown in the document for fields the user hasn't filled in, so it can be completed by hand. */
const BLANK = "\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_";

/** Escapes all ASCII punctuation so user text renders literally (no markdown, no raw HTML). */
function escapeMarkdown(text: string): string {
  return text.replace(/[!-/:-@[-`{-~]/g, "\\$&");
}

/** For single-line contexts such as table cells and list items. */
function inline(text: string, fallback = BLANK): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed ? escapeMarkdown(collapsed) : fallback;
}

/** For paragraph contexts: keeps the user's line breaks. */
function block(text: string, fallback = BLANK): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(escapeMarkdown);
  return lines.length ? lines.join("  \n") : fallback;
}

export const MIN_YEARS = 1;
export const MAX_YEARS = 99;

/** Parses a years input, clamped to [MIN_YEARS, MAX_YEARS]; null while the text isn't a number. */
export function parseYears(text: string): number | null {
  const years = Number(text);
  if (!text.trim() || !Number.isFinite(years)) return null;
  return Math.min(MAX_YEARS, Math.max(MIN_YEARS, Math.trunc(years)));
}

export function formatYears(years: number): string {
  return `${years} year${years === 1 ? "" : "s"}`;
}

/** Formats an ISO date (YYYY-MM-DD) as e.g. "October 11, 2026" without timezone shifts. */
export function formatDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return "";
  const [, year, month, day] = match.map(Number);
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

/** Document title, e.g. "Mutual NDA - Acme Inc. - Globex". */
export function documentTitle(values: NdaValues): string {
  const companies = [values.party1.company, values.party2.company]
    .map((company) => company.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return ["Mutual NDA", ...companies].join(" - ");
}

/** PDF filename based on the document title, without characters that filesystems reject. */
export function pdfFileName(values: NdaValues): string {
  const safe = documentTitle(values)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/[. ]+$/, "");
  return `${safe}.pdf`;
}

function checkbox(checked: boolean): string {
  return checked ? "- [x]     " : "- [ ]     ";
}

/**
 * Replaces exactly one occurrence of `search`. Throws if it is missing so that a change to the
 * upstream template fails loudly instead of silently leaving placeholders in a contract.
 */
function replaceOnce(text: string, search: string, replacement: string): string {
  const index = text.indexOf(search);
  if (index === -1) {
    throw new Error(`Mutual NDA cover page template is missing expected text: "${search}"`);
  }
  return text.slice(0, index) + replacement + text.slice(index + search.length);
}

export function fillCoverPage(template: string, values: NdaValues): string {
  const expires = values.mndaTermType === "expires";
  const confidentialityYears = values.confidentialityTermType === "years";
  const { party1: p1, party2: p2 } = values;

  const replacements: [string, string][] = [
    [
      "[Evaluating whether to enter into a business relationship with the other party.]",
      block(values.purpose),
    ],
    ["[Today’s date]", inline(formatDate(values.effectiveDate))],
    [
      "- [x]     Expires [1 year(s)] from Effective Date.",
      `${checkbox(expires)}Expires ${formatYears(values.mndaTermYears)} from Effective Date.`,
    ],
    [
      "- [ ]     Continues until terminated",
      `${checkbox(!expires)}Continues until terminated`,
    ],
    [
      "- [x]     [1 year(s)] from Effective Date, but in the case of trade secrets",
      `${checkbox(confidentialityYears)}${formatYears(values.confidentialityTermYears)} from Effective Date, but in the case of trade secrets`,
    ],
    ["- [ ]     In perpetuity.", `${checkbox(!confidentialityYears)}In perpetuity.`],
    ["Governing Law: [Fill in state]", `Governing Law: ${inline(values.governingLaw)}`],
    [
      "Jurisdiction: [Fill in city or county and state, i.e. “courts located in New Castle, DE”]",
      `Jurisdiction: ${inline(values.jurisdiction)}`,
    ],
    ["List any modifications to the MNDA", block(values.modifications, "None.")],
    ["| Print Name | |", `| Print Name | ${inline(p1.name, "")} | ${inline(p2.name, "")} |`],
    ["| Title | | |", `| Title | ${inline(p1.title, "")} | ${inline(p2.title, "")} |`],
    ["| Company | | |", `| Company | ${inline(p1.company, "")} | ${inline(p2.company, "")} |`],
    [
      "</label> | | |",
      `</label> | ${inline(p1.noticeAddress, "")} | ${inline(p2.noticeAddress, "")} |`,
    ],
  ];

  return replacements.reduce(
    (text, [search, replacement]) => replaceOnce(text, search, replacement),
    template,
  );
}
