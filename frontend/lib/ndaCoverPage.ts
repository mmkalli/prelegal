// Fills the Common Paper Mutual NDA's own cover page template. The other documents get a generated
// cover page (lib/coverPage.ts); the Mutual NDA ships a hand-made one with checkboxes and hints.

import { block, formatDate, formatYears, inline } from "./markdown";
import type { DocumentValues } from "./types";

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

export function fillNdaCoverPage(template: string, { fields, parties }: DocumentValues): string {
  const expires = fields.mndaTermType !== "untilTerminated";
  const confidentialityYears = fields.confidentialityTermType !== "perpetual";
  const years = (value: string) => formatYears(Number(value) || 1);
  const { party1: p1, party2: p2 } = parties;

  const replacements: [string, string][] = [
    [
      "[Evaluating whether to enter into a business relationship with the other party.]",
      block(fields.purpose),
    ],
    ["[Today’s date]", inline(formatDate(fields.effectiveDate))],
    [
      "- [x]     Expires [1 year(s)] from Effective Date.",
      `${checkbox(expires)}Expires ${years(fields.mndaTermYears)} from Effective Date.`,
    ],
    [
      "- [ ]     Continues until terminated",
      `${checkbox(!expires)}Continues until terminated`,
    ],
    [
      "- [x]     [1 year(s)] from Effective Date, but in the case of trade secrets",
      `${checkbox(confidentialityYears)}${years(fields.confidentialityTermYears)} from Effective Date, but in the case of trade secrets`,
    ],
    ["- [ ]     In perpetuity.", `${checkbox(!confidentialityYears)}In perpetuity.`],
    ["Governing Law: [Fill in state]", `Governing Law: ${inline(fields.governingLaw)}`],
    [
      "Jurisdiction: [Fill in city or county and state, i.e. “courts located in New Castle, DE”]",
      `Jurisdiction: ${inline(fields.jurisdiction)}`,
    ],
    ["List any modifications to the MNDA", block(fields.modifications, "None.")],
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
