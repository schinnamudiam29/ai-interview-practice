import "server-only";
import { buildMessages, buildSystemPrompt } from "@/lib/ai/prompt";
import { generate, ModelError } from "@/lib/ai";
import { getChallenge, isEditablePath } from "@/lib/challenges";
import type { ChallengePackage, Mode } from "@/lib/challenges/types";
import { AI, LIMITS } from "@/lib/config";
import { HttpError } from "@/lib/http";
import type { Identity } from "@/lib/identity";
import { assertCanStartChallenge, consumeAiMessage, consumeRun, recordSpend } from "@/lib/quota";
import { sandbox, SANDBOX_COST_PER_SECOND, type RunResult } from "@/lib/sandbox";
import { store, type EventRow, type SessionRow } from "@/lib/store";
import { authEnabled } from "@/lib/supabase/server";
import type { SessionSummary, SessionView, ViewMessage, ViewRun, ViewTest } from "@/lib/view-types";

// ---------------------------------------------------------------- loading

export async function startSession(identity: Identity, slug: string, mode: Mode): Promise<SessionRow> {
  const pkg = getChallenge(slug);
  if (!pkg) throw new HttpError(404, "Challenge not found");
  if (mode !== "interview") {
    throw new HttpError(400, "Guided mode is coming soon. Try Interview mock for now.");
  }
  await assertCanStartChallenge(identity, Boolean(pkg.meta.isDemo));

  const session = await store().createSession({
    user_id: identity.userId,
    guest_id: identity.userId ? null : identity.guestId,
    challenge_slug: slug,
    challenge_version: pkg.version,
    mode,
    files: { ...pkg.starter },
  });
  await store().addEvent({ session_id: session.id, type: "session_start", data: { mode, version: pkg.version } });
  return session;
}

/** Load a session the caller owns, or 404 (never reveal that it exists). */
export async function loadOwnedSession(id: string, identity: Identity) {
  const session = await store().getSession(id);
  const owns =
    session &&
    ((identity.userId && session.user_id === identity.userId) ||
      (!session.user_id && identity.guestId && session.guest_id === identity.guestId));
  if (!session || !owns) throw new HttpError(404, "Session not found");
  const pkg = getChallenge(session.challenge_slug);
  if (!pkg) throw new HttpError(410, "This challenge is no longer available");
  return { session, pkg };
}

// ---------------------------------------------------------------- files

export function validateFiles(files: unknown): Record<string, string> {
  if (!files || typeof files !== "object" || Array.isArray(files)) throw new HttpError(400, "files must be an object");
  const entries = Object.entries(files as Record<string, unknown>);
  if (entries.length > LIMITS.maxFiles) throw new HttpError(400, `At most ${LIMITS.maxFiles} files`);
  let total = 0;
  const out: Record<string, string> = {};
  for (const [path, content] of entries) {
    if (typeof content !== "string") throw new HttpError(400, `${path}: content must be text`);
    if (!isEditablePath(path)) throw new HttpError(400, `${path}: you can't create or edit this path`);
    if (content.length > LIMITS.maxFileBytes) throw new HttpError(400, `${path} is too large`);
    total += content.length;
    out[path] = content;
  }
  if (total > LIMITS.maxTotalBytes) throw new HttpError(400, "Workspace is too large");
  return out;
}

export async function saveFiles(session: SessionRow, raw: unknown): Promise<Record<string, string>> {
  if (session.status === "completed") throw new HttpError(409, "This session is finished; the code is read-only.");
  const files = validateFiles(raw);
  const changed = [
    ...new Set([...Object.keys(files), ...Object.keys(session.files)]),
  ].filter((p) => files[p] !== session.files[p]);
  if (changed.length) {
    await store().updateSession(session.id, { files });
    await store().addEvent({
      session_id: session.id,
      type: "files_changed",
      data: {
        paths: changed.slice(0, 20),
        chars_delta: Object.values(files).join("").length - Object.values(session.files).join("").length,
      },
    });
  }
  session.files = files;
  return files;
}

// ---------------------------------------------------------------- running

function toViewRun(kind: "run" | "submit", r: RunResult, hideMessages: boolean, stage?: "main" | "twist"): ViewRun {
  return {
    kind,
    stage,
    at: new Date().toISOString(),
    summary: r.summary,
    tests: r.tests.map(
      (t): ViewTest => ({
        suite: t.suite,
        name: t.name,
        status: t.status,
        // Hidden-test tracebacks can quote the test code, so only the name is shown.
        message: hideMessages && t.suite.startsWith("tests/hidden") ? "" : t.message,
      }),
    ),
    output: hideMessages ? "" : r.output,
    timedOut: r.timedOut,
    infraError: r.infraError,
  };
}

function runEventData(r: RunResult) {
  return {
    summary: r.summary,
    failing: r.tests.filter((t) => t.status !== "passed").map((t) => t.name).slice(0, 20),
    timed_out: r.timedOut,
    infra_error: Boolean(r.infraError),
    duration_ms: r.durationMs,
  };
}

function visibleSuites(session: SessionRow, pkg: ChallengePackage): string[] {
  const suites = [...pkg.meta.suites.visible];
  if (session.status !== "active") suites.push(...pkg.meta.suites.twist);
  return suites;
}

export async function runVisibleTests(identity: Identity, session: SessionRow, pkg: ChallengePackage, files: unknown) {
  await saveFiles(session, files);
  await consumeRun(identity, session);
  const result = await sandbox().run(session.files, visibleSuites(session, pkg));
  await recordSpend((result.durationMs / 1000) * SANDBOX_COST_PER_SECOND);
  await store().addEvent({ session_id: session.id, type: "run", data: runEventData(result) });
  return toViewRun("run", result, false);
}

export async function submit(identity: Identity, session: SessionRow, pkg: ChallengePackage, files: unknown) {
  const stage = session.status === "active" ? "main" : session.status === "twist" ? "twist" : null;
  if (!stage) throw new HttpError(409, "Nothing left to submit for this session.");
  await saveFiles(session, files);
  await consumeRun(identity, session);

  // Grade against the server's copies: drop anything the user put in grading folders.
  const graded: Record<string, string> = {};
  for (const [p, c] of Object.entries(session.files)) {
    if (!p.startsWith("tests/hidden/") && !p.startsWith("tests/twist/")) graded[p] = c;
  }
  Object.assign(graded, pkg.hidden);
  const suites = [...pkg.meta.suites.hidden];
  if (stage === "twist") {
    Object.assign(graded, pkg.twistTests);
    suites.push(...pkg.meta.suites.twist);
  }

  const result = await sandbox().run(graded, suites);
  await recordSpend((result.durationMs / 1000) * SANDBOX_COST_PER_SECOND);
  if (result.infraError || !result.summary) {
    await store().addEvent({ session_id: session.id, type: "submit_failed", data: runEventData(result) });
    throw new HttpError(503, result.infraError ?? "Grading didn't finish. Your code is saved; please submit again.");
  }

  await store().addSubmission({
    session_id: session.id,
    stage,
    passed: result.summary.passed,
    total: result.summary.total,
    results: result.tests.map(({ suite, name, status }) => ({ suite, name, status })),
  });
  await store().addEvent({ session_id: session.id, type: "submit", data: { stage, ...runEventData(result) } });

  if (stage === "main") {
    // The follow-up twist arrives: its tests join the workspace so the user can run them.
    const files = { ...session.files, ...pkg.twistTests };
    await store().updateSession(session.id, {
      status: "twist",
      twist_unlocked_at: new Date().toISOString(),
      files,
    });
  } else {
    await store().updateSession(session.id, { status: "explain" });
  }
  return toViewRun("submit", result, true, stage);
}

// ---------------------------------------------------------------- assistant

function lastRunText(events: EventRow[]): string | null {
  const last = [...events].reverse().find((e) => e.type === "run");
  if (!last) return null;
  const d = last.data as { summary?: { passed: number; total: number } | null; failing?: string[] };
  if (!d.summary) return "Last run did not produce test results.";
  return `${d.summary.passed}/${d.summary.total} visible tests passed.${
    d.failing?.length ? ` Not passing: ${d.failing.join(", ")}` : ""
  }`;
}

export async function chat(identity: Identity, session: SessionRow, pkg: ChallengePackage, rawText: unknown) {
  if (typeof rawText !== "string" || !rawText.trim()) throw new HttpError(400, "Message is empty");
  const text = rawText.trim();
  if (text.length > LIMITS.maxMessageChars) {
    throw new HttpError(400, `Messages are limited to ${LIMITS.maxMessageChars.toLocaleString()} characters.`);
  }
  if (session.status === "completed") throw new HttpError(409, "This session is finished.");
  const policy = pkg.policy[session.mode];
  await consumeAiMessage(identity, session, policy.max_messages);

  const [history, events] = await Promise.all([
    store().listMessages(session.id),
    store().listEvents(session.id),
  ]);
  const userMsg = await store().addMessage({
    session_id: session.id,
    role: "user",
    content: text,
    label: null,
    blocked: false,
    input_tokens: null,
    output_tokens: null,
    cost_usd: null,
  });

  const workspaceBrief = session.status === "active" ? pkg.brief : `${pkg.brief}\n\n${pkg.twist}`;
  const request = {
    system: buildSystemPrompt(policy, pkg.meta.title),
    messages: buildMessages(
      history.filter((m) => m.role !== "system" && !m.blocked).map((m) => ({
        role: m.role as "user" | "assistant",
        text: m.content,
      })),
      text,
      { brief: workspaceBrief, files: session.files, lastRun: lastRunText(events) },
      AI.historyChars,
    ),
    maxOutputTokens: AI.maxOutputTokens[session.mode],
  };

  try {
    const reply = await generate(request);
    await recordSpend(reply.costUsd);
    const assistantMsg = await store().addMessage({
      session_id: session.id,
      role: "assistant",
      content: reply.text,
      label: null,
      blocked: false,
      input_tokens: reply.inputTokens,
      output_tokens: reply.outputTokens,
      cost_usd: reply.costUsd,
    });
    await store().addEvent({
      session_id: session.id,
      type: "ai_message",
      data: { chars_in: text.length, chars_out: reply.text.length, tokens_in: reply.inputTokens, tokens_out: reply.outputTokens },
    });
    return { user: toViewMessage(userMsg), assistant: toViewMessage(assistantMsg) };
  } catch (err) {
    const kind = err instanceof ModelError ? err.kind : "unavailable";
    console.error("assistant error", kind, err);
    await store().addEvent({ session_id: session.id, type: "ai_error", data: { kind } });
    const message =
      kind === "rate_limited"
        ? "The assistant is busy right now. Wait a few seconds and try again; keep coding meanwhile."
        : kind === "blocked"
          ? "The assistant couldn't answer that message. Try rephrasing it."
          : "The assistant is unavailable right now. Keep coding; you can still run and submit.";
    throw new HttpError(503, message, `ai_${kind}`);
  }
}

function toViewMessage(m: { id: number; role: string; content: string; created_at: string }): ViewMessage {
  return { id: m.id, role: m.role as "user" | "assistant", content: m.content, at: m.created_at };
}

// ---------------------------------------------------------------- events & explanation

const CLIENT_EVENTS = new Set(["paste", "file_open", "file_create", "file_delete", "brief_view"]);

export async function logClientEvent(session: SessionRow, type: unknown, data: unknown) {
  if (typeof type !== "string" || !CLIENT_EVENTS.has(type)) throw new HttpError(400, "Unknown event");
  const payload = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  if (JSON.stringify(payload).length > 2000) throw new HttpError(400, "Event too large");
  await store().addEvent({ session_id: session.id, type, data: payload });
}

export async function saveExplanation(session: SessionRow, raw: unknown) {
  if (session.status !== "explain") throw new HttpError(409, "Submit the follow-up first.");
  if (typeof raw !== "string") throw new HttpError(400, "Explanation must be text");
  const text = raw.trim();
  if (text.length < LIMITS.explanationMinChars) {
    throw new HttpError(400, "Write a few sentences: root cause, your fix, and a trade-off.");
  }
  if (text.length > LIMITS.explanationMaxChars) throw new HttpError(400, "Explanation is too long");
  await store().updateSession(session.id, {
    explanation: text,
    status: "completed",
    completed_at: new Date().toISOString(),
  });
  await store().addEvent({ session_id: session.id, type: "explanation", data: { chars: text.length } });
}

// ---------------------------------------------------------------- view

function secondsBetween(a: string, b: string) {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000));
}

function summarize(session: SessionRow, events: EventRow[], submissions: SessionView["submissions"]): SessionSummary {
  const start = session.created_at;
  const firstOf = (pred: (e: EventRow) => boolean) => {
    const e = events.find(pred);
    return e ? secondsBetween(start, e.created_at) : null;
  };
  const end = session.completed_at ?? new Date().toISOString();
  return {
    minutes: Math.round(secondsBetween(start, end) / 60),
    runs: events.filter((e) => e.type === "run").length,
    aiMessages: events.filter((e) => e.type === "ai_message").length,
    largePastes: events.filter((e) => e.type === "paste" && Number((e.data as { chars?: number }).chars) >= 200).length,
    firstRunAfterSec: firstOf((e) => e.type === "run"),
    firstAiAfterSec: firstOf((e) => e.type === "ai_message"),
    firstGreenVisibleAfterSec: firstOf((e) => {
      const s = (e.data as { summary?: { passed: number; total: number } | null }).summary;
      return e.type === "run" && !!s && s.total > 0 && s.passed === s.total;
    }),
    submissions,
  };
}

export async function buildView(session: SessionRow, pkg: ChallengePackage, identity: Identity): Promise<SessionView> {
  const [messages, submissionsRaw, events] = await Promise.all([
    store().listMessages(session.id),
    store().listSubmissions(session.id),
    store().listEvents(session.id),
  ]);
  const submissions = submissionsRaw.map((s) => ({ stage: s.stage, passed: s.passed, total: s.total, at: s.created_at }));
  return {
    id: session.id,
    status: session.status,
    mode: session.mode,
    challenge: {
      slug: pkg.meta.slug,
      title: pkg.meta.title,
      difficulty: pkg.meta.difficulty,
      estimatedMinutes: pkg.meta.estimatedMinutes,
      openFile: pkg.meta.openFile,
    },
    brief: pkg.brief,
    twist: session.status === "active" ? null : pkg.twist,
    files: session.files,
    starterPaths: Object.keys(pkg.starter),
    messages: messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map(toViewMessage),
    submissions,
    lastRun: null,
    explanation: session.explanation,
    summary: session.status === "completed" ? summarize(session, events, submissions) : null,
    viewer: { isGuest: !identity.userId, email: identity.email, authEnabled: authEnabled() },
  };
}
