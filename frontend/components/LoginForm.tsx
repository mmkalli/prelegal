"use client";

import { useState, type FormEvent } from "react";
import { login } from "@/lib/api";
import { saveUser, useRedirect, useUser } from "@/lib/auth";

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Enter the platform once signed in, including when returning to this page in the same tab.
  useRedirect(Boolean(useUser()), "/app/");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      saveUser(await login(email, password));
    } catch (err) {
      console.error("Sign in failed", err);
      setError("Couldn't sign you in. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-medium text-neutral-800">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          className={inputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium text-neutral-800">Password</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-brand-purple px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-purple/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
