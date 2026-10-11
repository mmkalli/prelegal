"use client";

import type { ReactNode } from "react";
import { useRedirect, useUser } from "@/lib/auth";

/** Renders its children only for a signed-in user; otherwise sends the visitor to the login page. */
export function AuthGuard({ children }: { children: ReactNode }) {
  const user = useUser();
  useRedirect(user === null, "/login/");

  if (!user) {
    return (
      <p role="status" className="p-8 text-center text-sm text-brand-gray">
        Loading…
      </p>
    );
  }
  return children;
}
