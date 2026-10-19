"use client";

import { useState } from "react";

const MIN = 40;

export function ExplainPanel({ onSubmit }: { onSubmit: (text: string) => Promise<string | null> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(await onSubmit(text));
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex h-full flex-col gap-3 overflow-y-auto px-4 py-4">
      <h2 className="text-base font-bold">Explain your work</h2>
      <p className="text-sm leading-relaxed text-ink-soft">
        In an interview you&apos;d say this out loud. Cover:
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
        <li>the root cause of the problem</li>
        <li>what you changed, and why that fix rather than another</li>
        <li>one trade-off or risk in your approach</li>
        <li>what you&apos;d test next with more time</li>
      </ul>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        aria-label="Your explanation"
        className="w-full flex-1 resize-none rounded-md border border-rule bg-surface px-3 py-2 text-sm leading-relaxed outline-none focus:border-marker"
      />
      {error && (
        <p className="text-sm text-fail" role="alert">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-ink-faint">
          {text.trim().length < MIN ? `${MIN - text.trim().length} more characters` : "Ready to submit"}
        </span>
        <button
          disabled={busy || text.trim().length < MIN}
          className="rounded-md bg-marker px-4 py-2 text-sm font-semibold text-white hover:bg-marker-dark disabled:opacity-50"
        >
          {busy ? "Saving…" : "Finish session"}
        </button>
      </div>
    </form>
  );
}
