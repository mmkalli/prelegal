// Builds a document's cover page: the values of the variables its Standard Terms refer to, the
// parties and a signature block. The Common Paper templates other than the Mutual NDA ship only
// their Standard Terms, so their cover page is generated from the document spec.

import { BLANK, formatDate, inline } from "./markdown";
import { fillNdaCoverPage } from "./ndaCoverPage";
import type { DocumentContent, DocumentSpec, DocumentValues, FieldSpec } from "./types";

function fieldValue(field: FieldSpec, value: string): string {
  if (!value.trim()) return field.optional ? "None" : BLANK;
  return inline(field.kind === "date" ? formatDate(value) || value : value);
}

function row(cells: string[]): string {
  return `| ${cells.join(" | ")} |`;
}

export function generateCoverPage(spec: DocumentSpec, { fields, parties }: DocumentValues): string {
  const variable = (label: string) => `<span class="coverpage_link">${label}</span>`;
  const party = (key: keyof DocumentValues["parties"][string]) =>
    spec.parties.map((p) => inline(parties[p.key]?.[key] ?? "", ""));

  return [
    `# ${spec.name}`,
    `This Cover Page and the ${spec.name} Standard Terms below make up the agreement. ` +
      "The highlighted terms in the Standard Terms are defined here; terms marked “None” do not apply.",
    "## Key Terms",
    [
      row(["Term", "Value"]),
      row(["---", "---"]),
      ...spec.fields.map((field) => row([variable(field.label), fieldValue(field, fields[field.key] ?? "")])),
    ].join("\n"),
    "## Parties",
    `By signing this Cover Page, each party agrees to enter into this ${spec.name}.`,
    [
      row(["", ...spec.parties.map((p) => variable(p.label))]),
      row(["---", ...spec.parties.map(() => "---")]),
      row(["Signature", ...spec.parties.map(() => "")]),
      row(["Print Name", ...party("name")]),
      row(["Title", ...party("title")]),
      row(["Company", ...party("company")]),
      row(["Notice Address", ...party("noticeAddress")]),
      row(["Date", ...spec.parties.map(() => "")]),
    ].join("\n"),
  ].join("\n\n");
}

/** Documents that ship a hand-made cover page template, and how to fill it in. */
const TEMPLATE_FILLERS: Record<string, (template: string, values: DocumentValues) => string> = {
  "mutual-nda": fillNdaCoverPage,
};

export function buildCoverPage(content: DocumentContent, values: DocumentValues): string {
  const fill = TEMPLATE_FILLERS[content.spec.slug];
  return content.coverPage !== null && fill
    ? fill(content.coverPage, values)
    : generateCoverPage(content.spec, values);
}
