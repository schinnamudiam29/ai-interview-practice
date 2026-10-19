import type { SessionStatus } from "@/lib/view-types";

const STAGES: { status: SessionStatus; label: string }[] = [
  { status: "active", label: "Fix the bug" },
  { status: "twist", label: "Follow-up" },
  { status: "explain", label: "Explain" },
  { status: "completed", label: "Feedback" },
];

/** Where the user is in the round. The one place the highlighter colour appears. */
export function StageStrip({ status }: { status: SessionStatus }) {
  const current = STAGES.findIndex((s) => s.status === status);
  return (
    <ol className="flex items-center gap-1 text-[13px]" aria-label="Session progress">
      {STAGES.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.status} className="flex items-center gap-1" aria-current={active ? "step" : undefined}>
            {i > 0 && <span aria-hidden className={`h-px w-4 ${done || active ? "bg-ink-soft" : "bg-rule"}`} />}
            <span
              className={[
                "whitespace-nowrap rounded px-1.5 py-0.5",
                active ? "highlight font-bold text-ink" : done ? "text-ink-soft" : "text-ink-faint",
              ].join(" ")}
            >
              <span className="font-mono text-[11px]">{done ? "✓" : i + 1}</span> {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
