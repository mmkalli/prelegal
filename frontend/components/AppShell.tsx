"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth, useRedirect } from "@/lib/auth";
import { DISCLAIMER } from "./Disclaimer";
import { Button } from "./ui/Button";
import { Logo } from "./ui/Logo";

const NAV = [
  { href: "/documents/", label: "My documents" },
  { href: "/documents/new/", label: "New document" },
];

function AppHeader() {
  // Exported pages end in "/" (trailingSlash); the dev server drops it.
  const path = usePathname().replace(/\/?$/, "/");
  const { user, signOut } = useAuth();

  return (
    <header className="border-b border-neutral-200 bg-white print:hidden">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-8 px-4">
        <Link href="/documents/" aria-label="Prelegal home">
          <Logo className="text-lg" />
        </Link>
        <nav aria-label="Main" className="flex gap-1">
          {NAV.map((item) => {
            const active = path === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-2 text-sm font-medium ${
                  active ? "bg-brand-navy/5 text-brand-navy" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-sm text-brand-gray sm:inline">{user?.email}</span>
          <Button variant="secondary" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}

/** The signed-in app: header, page and footer. Visitors who aren't signed in go to the login page. */
export function AppShell({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  useRedirect(status === "anonymous", "/login/");

  if (status !== "authenticated") {
    return (
      <div role="status" className="grid flex-1 place-items-center text-sm text-brand-gray">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="border-t border-neutral-200 bg-white print:hidden">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-4 text-xs text-brand-gray sm:flex-row sm:justify-between">
          <p>{DISCLAIMER}</p>
          <p>Templates by Common Paper, CC BY 4.0.</p>
        </div>
      </footer>
    </div>
  );
}
