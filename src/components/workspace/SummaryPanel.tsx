import Link from "next/link";
import type { SessionView } from "@/lib/view-types";

function fmt(sec: number | null) {
  if (sec === null) return "never";
  if (sec < 60) return `${sec}s in`;
  return `${Math.round(sec / 60)} min in`;
}

export function SummaryPanel({ view }: { view: SessionView }) {
  const s = view.summary;
  if (!s) return null;
  const main = s.submissions.find((x) => x.stage === "main");
  const twist = s.submissions.find((x) => x.stage === "twist");

  const rows: [string, string][] = [
    ["Time spent", `${s.minutes} min`],
    ["Test runs", String(s.runs)],
    ["Assistant messages", String(s.aiMessages)],
    ["Large pastes (200+ chars)", String(s.largePastes)],
    ["First test run", fmt(s.firstRunAfterSec)],
    ["First assistant message", fmt(s.firstAiAfterSec)],
    ["All visible tests green", fmt(s.firstGreenVisibleAfterSec)],
  ];

  return (
    <div className="h-full space-y-6 overflow-y-auto px-4 py-4">
      <div>
        <h2 className="text-base font-bold">Session complete</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Detailed scoring with evidence for each dimension is coming next. For now, here&apos;s what was measured.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        {[
          ["Fix: hidden tests", main],
          ["Follow-up tests", twist],
        ].map(([label, sub]) => {
          const x = sub as typeof main;
          const green = x && x.passed === x.total;
          return (
            <div key={label as string} className="rounded-lg border border-rule bg-surface p-3">
              <dt className="text-[12px] text-ink-soft">{label as string}</dt>
              <dd className={`mt-1 text-2xl font-extrabold ${x ? (green ? "text-pass" : "text-fail") : "text-ink-faint"}`}>
                {x ? `${x.passed}/${x.total}` : "—"}
              </dd>
            </div>
          );
        })}
      </dl>

      <dl className="divide-y divide-rule-soft rounded-lg border border-rule bg-surface text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-3 py-2">
            <dt className="text-ink-soft">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      {view.explanation && (
        <div>
          <h3 className="text-sm font-bold">Your explanation</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{view.explanation}</p>
        </div>
      )}

      <Link href="/" className="inline-block rounded-md border border-rule bg-surface px-3 py-1.5 text-sm font-medium hover:border-ink-faint">
        Back to challenges
      </Link>
    </div>
  );
}
