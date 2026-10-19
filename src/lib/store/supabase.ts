import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";
import type {
  EventRow,
  MessageRow,
  NewSession,
  Owner,
  SessionPatch,
  SessionRow,
  Store,
  SubmissionRow,
} from "./types";

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`database error: ${res.error.message}`);
  return res.data;
}

/** Postgres-backed store. Uses the service-role key, so it must only run on the server. */
export class SupabaseStore implements Store {
  private db: SupabaseClient;

  constructor() {
    this.db = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }

  private ownerFilter<Q extends { eq: (c: string, v: string) => Q }>(q: Q, owner: Owner): Q {
    if (owner.userId) return q.eq("user_id", owner.userId);
    if (owner.guestId) return q.eq("guest_id", owner.guestId);
    throw new Error("owner required");
  }

  async createGuest(ipHash: string) {
    const row = check(await this.db.from("guests").insert({ ip_hash: ipHash }).select("id").single());
    return (row as { id: string }).id;
  }

  async countGuestsSince(ipHash: string, since: Date) {
    const res = await this.db
      .from("guests")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since.toISOString());
    if (res.error) throw new Error(res.error.message);
    return res.count ?? 0;
  }

  async createSession(input: NewSession) {
    return check(
      await this.db.from("practice_sessions").insert(input).select("*").single(),
    ) as SessionRow;
  }

  async getSession(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    return check(
      await this.db.from("practice_sessions").select("*").eq("id", id).maybeSingle(),
    ) as SessionRow | null;
  }

  async updateSession(id: string, patch: SessionPatch) {
    check(
      await this.db
        .from("practice_sessions")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id),
    );
  }

  async listSessions(owner: Owner, limit: number) {
    const q = this.db
      .from("practice_sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    return check(await this.ownerFilter(q, owner)) as SessionRow[];
  }

  async countSessionsSince(owner: Owner, since: Date) {
    const q = this.db
      .from("practice_sessions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since.toISOString());
    const res = await this.ownerFilter(q, owner);
    if (res.error) throw new Error(res.error.message);
    return res.count ?? 0;
  }

  async reassignGuestSessions(guestId: string, userId: string) {
    const rows = check(
      await this.db
        .from("practice_sessions")
        .update({ user_id: userId })
        .eq("guest_id", guestId)
        .is("user_id", null)
        .select("id"),
    ) as { id: string }[];
    return rows.length;
  }

  async addMessage(m: Omit<MessageRow, "id" | "created_at">) {
    return check(await this.db.from("messages").insert(m).select("*").single()) as MessageRow;
  }

  async listMessages(sessionId: string) {
    return check(
      await this.db.from("messages").select("*").eq("session_id", sessionId).order("id"),
    ) as MessageRow[];
  }

  async addEvent(e: Omit<EventRow, "id" | "created_at">) {
    check(await this.db.from("events").insert(e));
  }

  async listEvents(sessionId: string) {
    return check(
      await this.db.from("events").select("*").eq("session_id", sessionId).order("id"),
    ) as EventRow[];
  }

  async addSubmission(s: Omit<SubmissionRow, "id" | "created_at">) {
    return check(await this.db.from("submissions").insert(s).select("*").single()) as SubmissionRow;
  }

  async listSubmissions(sessionId: string) {
    return check(
      await this.db.from("submissions").select("*").eq("session_id", sessionId).order("id"),
    ) as SubmissionRow[];
  }

  async consumeQuota(key: string, windowStart: Date, limit: number, amount = 1) {
    const ok = check(
      await this.db.rpc("consume_quota", {
        p_key: key,
        p_window: windowStart.toISOString(),
        p_limit: limit,
        p_amount: amount,
      }),
    );
    return ok === true;
  }

  async addSpend(day: string, usd: number) {
    return Number(check(await this.db.rpc("add_spend", { p_day: day, p_cost: usd })));
  }

  async getSpend(day: string) {
    const row = check(
      await this.db.from("spend_daily").select("cost_usd").eq("day", day).maybeSingle(),
    ) as { cost_usd: number } | null;
    return Number(row?.cost_usd ?? 0);
  }
}
