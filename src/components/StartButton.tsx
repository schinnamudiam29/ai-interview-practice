"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function StartButton({ slug, label = "Start challenge" }: { slug: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; signup: boolean } | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, mode: "interview" }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError({ message: body.error ?? "Couldn't start the challenge.", signup: body.code === "signup_required" });
        setBusy(false);
        return;
      }
      router.push(`/s/${body.id}`);
    } catch {
      setError({ message: "Couldn't reach the server. Check your connection and try again.", signup: false });
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={start}
        disabled={busy}
        className="rounded-md bg-marker px-4 py-2 text-sm font-semibold text-white shadow-[0_1px_0_var(--marker-dark)] hover:bg-marker-dark disabled:opacity-60"
      >
        {busy ? "Setting up your workspace…" : label}
      </button>
      {error && (
        <p className="text-sm text-fail" role="alert">
          {error.message}{" "}
          {error.signup && (
            <a href="/login" className="font-semibold underline">
              Sign up free
            </a>
          )}
        </p>
      )}
    </div>
  );
}
