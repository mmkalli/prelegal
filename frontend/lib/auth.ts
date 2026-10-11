import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

// The signed-in user is kept in sessionStorage for the current tab. This is a UX gate only, not
// security: the login endpoint is still a stub and real authentication comes in a later ticket.

export type User = {
  email: string;
};

const STORAGE_KEY = "prelegal.user";
// sessionStorage does not emit "storage" events in the tab that changed it, so notify ourselves.
const CHANGE_EVENT = "prelegal:user-change";

function parseUser(raw: string | null): User | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return typeof value?.email === "string" ? value : null;
  } catch {
    return null;
  }
}

export function saveUser(user: User): void {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearUser(): void {
  window.sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * The current user, or `undefined` while prerendering and hydrating (storage is unavailable on the
 * server), so pages render the same markup on both sides before deciding where to go.
 */
export function useUser(): User | null | undefined {
  const raw = useSyncExternalStore(
    subscribe,
    () => window.sessionStorage.getItem(STORAGE_KEY),
    () => undefined,
  );
  return raw === undefined ? undefined : parseUser(raw);
}

/** Replaces the current route with `path` once `when` becomes true. */
export function useRedirect(when: boolean, path: string): void {
  const router = useRouter();
  useEffect(() => {
    if (when) router.replace(path);
  }, [when, path, router]);
}
