"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as api from "./api";
import type { User } from "./types";

// The session itself is an HttpOnly cookie set by the API; this context only mirrors who is
// signed in, asking the API on load. Pages are static, so access control happens in the API.

type AuthState =
  | { status: "loading"; user: null }
  | { status: "anonymous"; user: null }
  | { status: "authenticated"; user: User };

type AuthContextValue = AuthState & {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const LOADING: AuthState = { status: "loading", user: null };
const ANONYMOUS: AuthState = { status: "anonymous", user: null };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(LOADING);

  useEffect(() => {
    let active = true;
    api
      .me()
      .then((user) => active && setState({ status: "authenticated", user }))
      .catch(() => active && setState(ANONYMOUS));
    api.onUnauthorized(() => setState(ANONYMOUS));
    return () => {
      active = false;
      api.onUnauthorized(null);
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setState({ status: "authenticated", user: await api.login(email, password) });
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setState({ status: "authenticated", user: await api.signup(email, password) });
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setState(ANONYMOUS);
    }
  }, []);

  const value = useMemo(() => ({ ...state, signIn, signUp, signOut }), [state, signIn, signUp, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

/** Replaces the current route with `path` once `when` becomes true. */
export function useRedirect(when: boolean, path: string): void {
  const router = useRouter();
  useEffect(() => {
    if (when) router.replace(path);
  }, [when, path, router]);
}
