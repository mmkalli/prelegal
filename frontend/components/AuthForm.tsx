"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { errorText, MIN_PASSWORD_LENGTH } from "@/lib/api";
import { useAuth, useRedirect } from "@/lib/auth";
import { DISCLAIMER } from "./Disclaimer";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Logo } from "./ui/Logo";

type Mode = "login" | "signup";

const COPY = {
  login: {
    title: "Welcome back",
    subtitle: "Sign in to continue drafting your agreements.",
    submit: "Sign in",
    submitting: "Signing in…",
    switchText: "New to Prelegal?",
    switchLink: { href: "/signup/", label: "Create an account" },
  },
  signup: {
    title: "Create your account",
    subtitle: "Draft NDAs, cloud service agreements and more in minutes.",
    submit: "Create account",
    submitting: "Creating account…",
    switchText: "Already have an account?",
    switchLink: { href: "/login/", label: "Sign in" },
  },
};

const FEATURES = [
  "11 Common Paper agreements, from NDAs to cloud service and data processing agreements",
  "An AI assistant that asks the right questions and fills in the document",
  "Your drafts are saved, so you can pick up where you left off",
];

function BrandPanel() {
  return (
    <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-navy p-10 text-white lg:flex">
      <div aria-hidden className="absolute -right-24 -top-24 size-72 rounded-full bg-brand-blue/20" />
      <div aria-hidden className="absolute -bottom-32 -left-16 size-80 rounded-full bg-brand-purple/25" />
      <Logo tone="light" className="relative text-xl" />
      <div className="relative max-w-md">
        <h2 className="text-3xl font-semibold leading-tight">Legal agreements, drafted in a conversation.</h2>
        <ul className="mt-8 space-y-4 text-sm text-white/80">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex gap-3">
              <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-yellow" />
              {feature}
            </li>
          ))}
        </ul>
      </div>
      <p className="relative text-xs text-white/60">{DISCLAIMER}</p>
    </aside>
  );
}

export function AuthForm({ mode }: { mode: Mode }) {
  const copy = COPY[mode];
  const { status, signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signed in already, or just now: go to the documents.
  useRedirect(status === "authenticated", "/documents/");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await (mode === "login" ? signIn : signUp)(email, password);
    } catch (err) {
      setError(errorText(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <BrandPanel />
      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <Logo className="text-xl lg:hidden" />
          <h1 className="mt-8 text-2xl font-semibold tracking-tight text-brand-navy lg:mt-0">{copy.title}</h1>
          <p className="mt-1 text-sm text-brand-gray">{copy.subtitle}</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <Input
              label="Email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Password"
              type="password"
              required
              minLength={mode === "signup" ? MIN_PASSWORD_LENGTH : undefined}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              hint={mode === "signup" ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" loading={submitting && copy.submitting}>
              {copy.submit}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-brand-gray">
            {copy.switchText}{" "}
            <Link href={copy.switchLink.href} className="font-medium text-brand-blue hover:underline">
              {copy.switchLink.label}
            </Link>
          </p>
          <p className="mt-10 text-center text-xs text-brand-gray lg:hidden">{DISCLAIMER}</p>
        </div>
      </main>
    </div>
  );
}
