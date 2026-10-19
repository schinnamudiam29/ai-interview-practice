"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/SiteHeader";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setState("error");
    } else {
      setState("sent");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4">
      <Logo />
      <h1 className="mt-8 text-2xl font-extrabold tracking-tight">Sign in or create an account</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Free accounts get 3 challenges a week. Anything you did as a guest moves into your account.
      </p>

      {!configured ? (
        <p className="mt-6 rounded-md border border-rule bg-surface p-3 text-sm text-ink-soft">
          Sign-in isn&apos;t configured in this environment.
        </p>
      ) : state === "sent" ? (
        <p className="mt-6 rounded-md border border-pass bg-pass-tint p-3 text-sm" role="status">
          Check <strong>{email}</strong> for a sign-in link. You can close this tab.
        </p>
      ) : (
        <form onSubmit={send} className="mt-6 space-y-3">
          <label className="block text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-rule bg-surface px-3 py-2 outline-none focus:border-marker"
          />
          <button
            disabled={state === "sending"}
            className="w-full rounded-md bg-marker py-2 text-sm font-semibold text-white hover:bg-marker-dark disabled:opacity-60"
          >
            {state === "sending" ? "Sending link…" : "Email me a sign-in link"}
          </button>
          {state === "error" && (
            <p className="text-sm text-fail" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
      <Link href="/" className="mt-8 text-sm text-ink-soft hover:text-ink">
        Back to challenges
      </Link>
    </main>
  );
}
