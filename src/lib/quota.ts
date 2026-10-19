import "server-only";
import { AI, LIMITS } from "@/lib/config";
import { HttpError } from "@/lib/http";
import type { Identity } from "@/lib/identity";
import { store, type SessionRow } from "@/lib/store";

const EPOCH = new Date(0);

export function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function dayStart(d = new Date()): Date {
  return new Date(`${utcDay(d)}T00:00:00.000Z`);
}

/** Monday 00:00 UTC of the current week. */
export function weekStart(d = new Date()): Date {
  const start = dayStart(d);
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  return new Date(start.getTime() - daysSinceMonday * 86_400_000);
}

function ownerKey(identity: Identity): string {
  return identity.userId ? `u:${identity.userId}` : `g:${identity.guestId}`;
}

export async function assertCanStartChallenge(identity: Identity, isDemo: boolean) {
  if (!identity.userId) {
    if (!isDemo) {
      throw new HttpError(403, "Sign up free to unlock this challenge. Guests can try the demo challenge.", "signup_required");
    }
    const n = await store().countSessionsSince({ guestId: identity.guestId }, dayStart());
    if (n >= 2) {
      throw new HttpError(429, "Guest limit reached for today. Sign up free to keep practising.", "signup_required");
    }
    return;
  }
  const n = await store().countSessionsSince({ userId: identity.userId }, weekStart());
  if (n >= LIMITS.free.challengesPerWeek) {
    throw new HttpError(429, `Free accounts can start ${LIMITS.free.challengesPerWeek} challenges per week. Your limit resets on Monday.`, "weekly_limit");
  }
}

export async function consumeRun(identity: Identity, session: SessionRow) {
  const now = Date.now();
  const cooldownMs = LIMITS.runCooldownSeconds * 1000;
  const slot = new Date(Math.floor(now / cooldownMs) * cooldownMs);
  if (!(await store().consumeQuota(`cool:${ownerKey(identity)}`, slot, 1))) {
    throw new HttpError(429, "Slow down a little: one run every few seconds.", "cooldown");
  }
  const ok = identity.userId
    ? await store().consumeQuota(`run:${ownerKey(identity)}`, dayStart(), LIMITS.free.runsPerDay)
    : await store().consumeQuota(`run:s:${session.id}`, EPOCH, LIMITS.guest.runsPerSession);
  if (!ok) throw new HttpError(429, "You've used all your test runs for now.", "run_limit");
}

export async function consumeAiMessage(identity: Identity, session: SessionRow, policyMax: number) {
  await assertSpendAvailable();
  const limit = Math.min(
    policyMax,
    identity.userId ? LIMITS.free.aiMessagesPerSession : LIMITS.guest.aiMessagesPerSession,
  );
  if (!(await store().consumeQuota(`ai:s:${session.id}`, EPOCH, limit))) {
    throw new HttpError(
      429,
      identity.userId
        ? "You've reached the assistant message limit for this challenge. Keep coding: you can still run and submit."
        : "Guest assistant limit reached. Sign up free for more messages.",
      "ai_limit",
    );
  }
}

export async function assertSpendAvailable() {
  const spent = await store().getSpend(utcDay());
  if (spent >= AI.dailySpendCapUsd) {
    throw new HttpError(503, "The assistant is paused for today because of high demand. The editor and tests still work.", "spend_cap");
  }
}

export async function recordSpend(usd: number) {
  if (usd > 0) await store().addSpend(utcDay(), usd);
}
