"use client";

import { useAuth, useRedirect } from "@/lib/auth";

/** Entry point: sends signed-in users to their documents and everyone else to the login page. */
export default function Home() {
  const { status } = useAuth();
  useRedirect(status !== "loading", status === "authenticated" ? "/documents/" : "/login/");
  return null;
}
