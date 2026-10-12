import type {
  ChatMessage,
  SelectResponse,
  DocumentContent,
  DocumentSpec,
  DocumentSummary,
  SavedDocument,
  User,
} from "./types";

// Limits shared with the backend (backend/app/schemas.py).
export const MAX_MESSAGE_LENGTH = 4000;
/** Only the most recent messages are sent; the document's values carry the rest of the context. */
export const MAX_HISTORY = 40;
export const MIN_PASSWORD_LENGTH = 8;

/** An error response from the API, with FastAPI's `detail` as the message when there is one. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function errorMessage(body: unknown, status: number): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  return status === 422 ? "Please check the details you entered." : `Request failed (${status})`;
}

/** A message for an error from the API (or the network) that can be shown to the user. */
export function errorText(error: unknown, fallback = "Something went wrong. Please try again."): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

let unauthorizedHandler: (() => void) | null = null;

/** Called when a request fails because the session ended (e.g. the server restarted). */
export function onUnauthorized(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

/**
 * Calls the API. Paths are relative (`/api/...`): in production the frontend is served by the
 * backend itself, and in development `next dev` proxies /api to it. The session is an HttpOnly
 * cookie, which the browser sends with these same-origin requests.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/api/auth/")) unauthorizedHandler?.();
    throw new ApiError(response.status, errorMessage(body, response.status));
  }
  return body as T;
}

const post = (body?: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body ?? {}) });

// --- Account ---------------------------------------------------------------------------------------

export const signup = (email: string, password: string) =>
  request<User>("/api/auth/signup", post({ email, password }));

export const login = (email: string, password: string) =>
  request<User>("/api/auth/login", post({ email, password }));

export const logout = () => request<void>("/api/auth/logout", post());

export const me = () => request<User>("/api/auth/me");

// --- Document types (cached: they only change with a new release) ---------------------------------

let catalog: Promise<DocumentSpec[]> | undefined;
const contents = new Map<string, Promise<DocumentContent>>();

function cached<T>(promise: Promise<T>, evict: () => void): Promise<T> {
  promise.catch(evict);
  return promise;
}

export function getCatalog(): Promise<DocumentSpec[]> {
  catalog ??= cached(request<DocumentSpec[]>("/api/catalog"), () => (catalog = undefined));
  return catalog;
}

export function getDocumentContent(slug: string): Promise<DocumentContent> {
  if (!contents.has(slug)) {
    contents.set(slug, cached(request<DocumentContent>(`/api/catalog/${slug}`), () => contents.delete(slug)));
  }
  return contents.get(slug)!;
}

// --- Documents --------------------------------------------------------------------------------------

/** One turn of the conversation that picks the document; `documentType` is set once it's chosen. */
export const selectDocument = (messages: ChatMessage[]) =>
  request<SelectResponse>("/api/chat/select", post({ messages: messages.slice(-MAX_HISTORY) }));

export const listDocuments = () => request<DocumentSummary[]>("/api/documents");

export const getDocument = (id: number) => request<SavedDocument>(`/api/documents/${id}`);

/** Starts a document, continuing the conversation that chose it (kept as its history). */
export const createDocument = (documentType: string, messages: ChatMessage[] = []) =>
  request<SavedDocument>("/api/documents", post({ documentType, messages: messages.slice(-MAX_HISTORY) }));

/** One chat turn: the assistant replies and fills in the document; the server saves both. */
export const sendMessage = (id: number, message: string) =>
  request<SavedDocument>(`/api/documents/${id}/chat`, post({ message }));

export const deleteDocument = (id: number) => request<void>(`/api/documents/${id}`, { method: "DELETE" });
