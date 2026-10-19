import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { StartButton } from "@/components/StartButton";
import { listPublicChallenges } from "@/lib/challenges";
import { getIdentity, ownerOf } from "@/lib/identity";
import { store, type SessionRow } from "@/lib/store";
import { authEnabled } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<SessionRow["status"], string> = {
  active: "In progress",
  twist: "Follow-up waiting",
  explain: "Explanation due",
  completed: "Finished",
};

const STEPS = [
  ["Investigate", "Read a small service, run its failing tests, and use the assistant however you like."],
  ["Submit", "Hidden tests check the edge cases you were told about, and the ones you should have found."],
  ["Follow-up", "A new requirement lands on top of your fix, the way an interviewer would add one."],
  ["Explain", "Write up the root cause, your fix and one trade-off. That goes into your feedback."],
];

export default async function Home() {
  const identity = await getIdentity();
  const challenges = listPublicChallenges();
  const titles = new Map(challenges.map((c) => [c.slug, c.title]));
  let recent: SessionRow[] = [];
  if (identity.userId || identity.guestId) {
    try {
      recent = await store().listSessions(ownerOf(identity), 5);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader email={identity.email} authEnabled={authEnabled()} />

      <main className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
        <section className="grid items-center gap-10 py-10 md:grid-cols-[1.05fr_1fr] md:py-16">
          <div>
            <h1 className="text-[2.4rem] font-extrabold leading-[1.05] tracking-[-0.02em] sm:text-[3.2rem]">
              Rehearse the AI&#8209;assisted coding round.
            </h1>
            <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-ink-soft">
              Debug a real multi-file codebase with an AI assistant beside you, the way the new interview rounds
              work. Then see how you worked, not just whether the tests went green.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              {challenges[0] && <StartButton slug={challenges.find((c) => c.isDemo)?.slug ?? challenges[0].slug} label="Try the demo challenge" />}
              <span className="text-sm text-ink-faint">No sign-up needed for the demo.</span>
            </div>
          </div>

          <figure aria-label="Example from the demo challenge" className="overflow-hidden rounded-xl border border-rule bg-surface shadow-[0_18px_40px_-24px_rgba(24,32,47,0.35)]">
            <div className="flex items-center gap-3 border-b border-rule-soft px-4 py-2.5 text-xs text-ink-faint">
              <span className="font-mono">orders/service.py</span>
              <span className="ml-auto rounded bg-fail-tint px-1.5 py-0.5 font-semibold text-fail">6 / 7 passing</span>
            </div>
            <pre className="overflow-x-auto bg-[#1f2738] px-4 py-3 font-mono text-[12.5px] leading-relaxed text-[#e6ebf3]">
{`if cursor is not None:
    after = decode_cursor(cursor)
    orders = [o for o in orders
              if o.created_at > after]`}
            </pre>
            <div className="space-y-3 px-4 py-4 text-sm">
              <p className="ml-auto w-fit max-w-[85%] rounded-lg bg-marker-tint px-3 py-2 text-ink">
                Why would an order vanish only when two share a timestamp?
              </p>
              <p className="max-w-[90%] rounded-lg border border-rule-soft px-3 py-2 text-ink-soft">
                The cursor only stores <code className="font-mono text-[12px] text-ink">created_at</code>. When the
                page ends partway through a tie, the next page starts strictly after that time…
              </p>
            </div>
          </figure>
        </section>

        <section aria-labelledby="how" className="border-t border-rule py-12">
          <h2 id="how" className="text-xl font-bold">
            How a session works
          </h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, body], i) => (
              <li key={title}>
                <span className="font-mono text-sm text-ink-faint">{i + 1}</span>
                <h3 className="mt-1 font-bold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        {recent.length > 0 && (
          <section aria-labelledby="recent" className="border-t border-rule py-12">
            <h2 id="recent" className="text-xl font-bold">
              Your sessions
            </h2>
            <ul className="mt-4 divide-y divide-rule-soft rounded-lg border border-rule bg-surface">
              {recent.map((s) => (
                <li key={s.id}>
                  <Link href={`/s/${s.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-paper">
                    <span className="font-medium">{titles.get(s.challenge_slug) ?? s.challenge_slug}</span>
                    <span className="flex shrink-0 gap-3 text-sm text-ink-soft">
                      <span>{STATUS_LABEL[s.status]}</span>
                      <time dateTime={s.created_at}>{new Date(s.created_at).toLocaleDateString()}</time>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="challenges" className="border-t border-rule py-12">
          <h2 id="challenges" className="text-xl font-bold">
            Challenges
          </h2>
          <p className="mt-1 text-sm text-ink-soft">Python. More are on the way.</p>
          <ul className="mt-6 space-y-4">
            {challenges.map((c) => (
              <li key={c.slug} className="flex flex-col gap-4 rounded-lg border border-rule bg-surface p-5 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <h3 className="font-bold">{c.title}</h3>
                  <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-ink-soft">{c.summary}</p>
                  <ul className="mt-3 flex flex-wrap gap-2 text-xs text-ink-soft">
                    <li className="rounded border border-rule px-1.5 py-0.5">{c.format === "debug" ? "Debugging" : c.format}</li>
                    <li className="rounded border border-rule px-1.5 py-0.5 capitalize">{c.difficulty}</li>
                    <li className="rounded border border-rule px-1.5 py-0.5">About {c.estimatedMinutes} min</li>
                    {c.isDemo && <li className="rounded bg-marker-tint px-1.5 py-0.5 text-marker-dark">Open to guests</li>}
                  </ul>
                </div>
                <StartButton slug={c.slug} />
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-rule py-8 text-center text-xs text-ink-faint">
        Practice feedback only, not a hiring assessment. Don&apos;t paste code from your employer.
      </footer>
    </div>
  );
}
