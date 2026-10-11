// Mirrors the API's models (backend/app/schemas.py and backend/app/documents/).

export type User = {
  id: number;
  email: string;
};

export type FieldSpec = {
  key: string;
  label: string;
  kind: "text" | "longtext" | "date" | "number" | "choice";
  help: string;
  optional: boolean;
  default: string;
  min: number | null;
  max: number | null;
  options: string[] | null;
};

export type PartySpec = {
  key: string;
  label: string;
};

export type DocumentSpec = {
  slug: string;
  name: string;
  description: string;
  parties: PartySpec[];
  fields: FieldSpec[];
};

/** A document type with the template text it is rendered from. */
export type DocumentContent = {
  spec: DocumentSpec;
  terms: string;
  /** The template for documents with a hand-made cover page (the Mutual NDA); otherwise generated. */
  coverPage: string | null;
};

export type Party = {
  name: string;
  title: string;
  company: string;
  noticeAddress: string;
};

/** Every value is a string, including numbers and choices. */
export type DocumentValues = {
  parties: Record<string, Party>;
  fields: Record<string, string>;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

/** A turn of the conversation that picks the document; `documentType` is set once it's chosen. */
export type SelectResponse = {
  reply: string;
  documentType: string | null;
};

export type DocumentSummary = {
  id: number;
  documentType: string;
  title: string;
  /** How many of the required terms are filled in. */
  filled: number;
  total: number;
  createdAt: string;
  updatedAt: string;
};

export type SavedDocument = DocumentSummary & {
  values: DocumentValues;
  messages: ChatMessage[];
  version: number;
};
