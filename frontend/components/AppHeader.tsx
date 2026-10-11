"use client";

import { useRouter } from "next/navigation";
import { clearUser, useUser } from "@/lib/auth";

export function AppHeader() {
  const router = useRouter();
  const user = useUser();

  const signOut = () => {
    clearUser();
    router.replace("/login/");
  };

  return (
    <header className="border-b-4 border-brand-yellow bg-brand-navy text-white print:hidden">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <span className="text-lg font-semibold tracking-tight">
          Pre<span className="text-brand-yellow">legal</span>
        </span>
        <div className="flex items-center gap-4">
          {user && <span className="hidden text-sm text-neutral-300 sm:inline">{user.email}</span>}
          <button
            type="button"
            onClick={signOut}
            className="rounded-md border border-white/40 px-3 py-1.5 text-sm font-medium hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
