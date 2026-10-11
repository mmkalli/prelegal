"use client";

import { useRedirect, useUser } from "@/lib/auth";

/** Entry point: sends signed-in users to the platform and everyone else to the login page. */
export default function Home() {
  const user = useUser();
  useRedirect(user !== undefined, user ? "/app/" : "/login/");
  return null;
}
