"use client";

import { useState } from "react";
import type { ViewRun, ViewTest } from "@/lib/view-types";

function shortName(name: string) {
  // tests.visible.test_api.ListOrdersApiTests.test_limit_must_be_positive_integer -> ListOrdersApiTests › test_limit…
  const parts = name.split(".");
  return parts.length >= 2 ? `${parts[parts.length - 2]} › ${parts[parts.length - 1]}` : name;
}

function TestRow({ t }: { t: ViewTest }) {
  const [open, setOpen] = useState(false);
  const ok = t.status === "passed";
  const skipped = t.status === "skipped";
  return (
    <li className="border-b border-rule-soft last:border-0">
      <button
        onClick={() => t.message && setOpen((v) => !v)}
        className={`flex w-full items-start gap-2 px-3 py-1.5 text-left ${t.message ? "hover:bg-paper" : "cursor-default"}`}
        aria-expanded={t.message ? open : undefined}
      >
        <span
          aria-label={t.status}
          className={`mt-0.5 font-mono text-[12px] font-semibold ${ok ? "text-pass" : skipped ? "text-ink-faint" : "text-fail"}`}
        >
          {ok ? "PASS" : skipped ? "SKIP" : t.status === "error" ? "ERR " : "FAIL"}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]" title={t.name}>
          {shortName(t.name)}
        </span>
        {t.message && <span className="text-[11px] text-ink-faint">{open ? "hide" : "details"}</span>}
      </button>
      {open && t.message && (
        <pre className="mx-3 mb-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-[#1f2738] p-2.5 font-mono text-[11.5px] leading-relaxed text-[#e6ebf3]">
          {t.message}
        </pre>
      )}
    </li>
  );
}

export function ResultsPanel({ run, busy }: { run: ViewRun | null; busy: "run" | "submit" | null }) {
  if (busy) {
    return (
      <div className="flex h-full items-center gap-3 px-4 text-sm text-ink-soft" role="status">
        <span className="h-2 w-2 animate-pulse rounded-full bg-marker" />
        {busy === "run" ? "Running your tests in a fresh sandbox…" : "Grading with the hidden tests…"}
      </div>
    );
  }
  if (!run) {
    return (
      <div className="flex h-full items-center px-4 text-sm text-ink-faint">
        Click Run (or press Ctrl/⌘ + Enter) to run the visible tests.
      </div>
    );
  }
  if (run.infraError) {
    return (
      <div className="px-4 py-3 text-sm text-fail" role="alert">
        {run.infraError}
      </div>
    );
  }

  const s = run.summary;
  const allGreen = s && s.total > 0 && s.passed === s.total;
  const heading =
    run.kind === "submit"
      ? run.stage === "twist"
        ? "Follow-up grading"
        : "Hidden test grading"
      : "Visible tests";
  const sorted = [...run.tests].sort((a, b) => Number(a.status === "passed") - Number(b.status === "passed"));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-rule-soft px-3 py-2 text-sm">
        <span className="font-semibold">{heading}</span>
        {s ? (
          <span
            className={`rounded px-1.5 py-0.5 text-[12px] font-semibold ${allGreen ? "bg-pass-tint text-pass" : "bg-fail-tint text-fail"}`}
          >
            {s.passed} / {s.total} passed
          </span>
        ) : (
          <span className="rounded bg-fail-tint px-1.5 py-0.5 text-[12px] font-semibold text-fail">No results</span>
        )}
        {run.timedOut && <span className="text-[12px] text-fail">Timed out</span>}
        {run.kind === "submit" && (
          <span className="text-[12px] text-ink-faint">Hidden test details stay hidden; names show what was checked.</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.length > 0 && <ul>{sorted.map((t) => <TestRow key={t.name} t={t} />)}</ul>}
        {run.output && (
          <details className="px-3 py-2" open={!s || s.total === 0}>
            <summary className="cursor-pointer text-[12px] font-semibold text-ink-soft">Program output</summary>
            <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap font-mono text-[11.5px] text-ink-soft">
              {run.output}
            </pre>
          </details>
        )}
        {s && s.total === 0 && !run.output && (
          <p className="px-3 py-2 text-sm text-ink-soft">No tests were found. Test files must be named test_*.py.</p>
        )}
      </div>
    </div>
  );
}
