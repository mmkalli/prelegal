// Test helpers that read the real templates and document specs from the repo.
import fs from "node:fs";
import path from "node:path";
import type { DocumentContent, DocumentSpec, DocumentValues, FieldSpec } from "@/lib/types";

const REPO = path.resolve(import.meta.dirname, "..", "..");

export function readTemplate(filename: string): string {
  return fs.readFileSync(path.join(REPO, "templates", filename), "utf-8").replace(/\r\n/g, "\n");
}

/** documents.json as written: fields omit their defaults, and template filenames are included. */
type RegistryEntry = Omit<DocumentSpec, "fields"> & {
  fields: (Pick<FieldSpec, "key" | "label" | "kind" | "help"> & Partial<FieldSpec>)[];
  terms: string;
  coverPage?: string;
};

const REGISTRY: RegistryEntry[] = JSON.parse(fs.readFileSync(path.join(REPO, "documents.json"), "utf-8"));

/** The specs as the API serves them (with the field defaults filled in). */
export const SPECS: DocumentSpec[] = REGISTRY.map(({ slug, name, description, parties, fields }) => ({
  slug,
  name,
  description,
  parties,
  fields: fields.map((field) => ({ optional: false, default: "", min: null, max: null, options: null, ...field })),
}));

export function spec(slug: string): DocumentSpec {
  return SPECS.find((s) => s.slug === slug)!;
}

/** The document content the API serves for `slug`. */
export function content(slug: string): DocumentContent {
  const entry = REGISTRY.find((s) => s.slug === slug)!;
  return {
    spec: spec(slug),
    terms: readTemplate(entry.terms),
    coverPage: entry.coverPage ? readTemplate(entry.coverPage) : null,
  };
}

/** A new document's values, as the backend creates them (backend/app/documents/values.py). */
export function initialValues(documentSpec: DocumentSpec): DocumentValues {
  const party = { name: "", title: "", company: "", noticeAddress: "" };
  return {
    parties: Object.fromEntries(documentSpec.parties.map((p) => [p.key, { ...party }])),
    fields: Object.fromEntries(documentSpec.fields.map((f) => [f.key, f.default])),
  };
}
