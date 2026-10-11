import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-sm">
        <div className="h-1.5 bg-brand-yellow" />
        <div className="p-8">
          <p className="text-2xl font-semibold tracking-tight text-brand-navy">
            Pre<span className="text-brand-blue">legal</span>
          </p>
          <h1 className="mt-6 text-lg font-semibold text-brand-navy">Sign in</h1>
          <p className="mt-1 mb-6 text-sm text-brand-gray">
            Draft common legal agreements in minutes.
          </p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
