import type { User } from "./auth";
import type { NdaValues } from "./nda";

/**
 * Calls the backend API. Paths are relative (`/api/...`): in production the frontend is served by
 * the backend itself, and in development `next dev` proxies /api to it.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
}

export function login(email: string, password: string): Promise<User> {
  return request<User>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// Limits shared with the backend (backend/app/schemas.py).
export const MAX_MESSAGE_LENGTH = 4000;
/** Only the most recent messages are sent; the current values carry the rest of the context. */
export const MAX_HISTORY = 40;

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

/** The assistant's reply and the agreement values with its changes applied. */
export type ChatTurn = {
  reply: string;
  values: NdaValues;
};

export function sendChat(messages: ChatMessage[], values: NdaValues): Promise<ChatTurn> {
  return request<ChatTurn>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ messages: messages.slice(-MAX_HISTORY), values }),
  });
}
