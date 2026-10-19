import { randomUUID } from "node:crypto";
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

/** In-process store for local development and tests. Data is lost on restart. */
export class MemoryStore implements Store {
  private guests = new Map<string, { ipHash: string; createdAt: Date }>();
  private sessions = new Map<string, SessionRow>();
  private messages: MessageRow[] = [];
  private events: EventRow[] = [];
  private submissions: SubmissionRow[] = [];
  private counters = new Map<string, number>();
  private spend = new Map<string, number>();
  private seq = 1;

  async createGuest(ipHash: string) {
    const id = randomUUID();
    this.guests.set(id, { ipHash, createdAt: new Date() });
    return id;
  }

  async countGuestsSince(ipHash: string, since: Date) {
    let n = 0;
    for (const g of this.guests.values()) if (g.ipHash === ipHash && g.createdAt >= since) n++;
    return n;
  }

  async createSession(input: NewSession) {
    const now = new Date().toISOString();
    const row: SessionRow = {
      id: randomUUID(),
      ...input,
      status: "active",
      explanation: null,
      hints_unlocked: 0,
      created_at: now,
      updated_at: now,
      twist_unlocked_at: null,
      completed_at: null,
    };
    this.sessions.set(row.id, row);
    return structuredClone(row);
  }

  async getSession(id: string) {
    const row = this.sessions.get(id);
    return row ? structuredClone(row) : null;
  }

  async updateSession(id: string, patch: SessionPatch) {
    const row = this.sessions.get(id);
    if (!row) throw new Error("session not found");
    Object.assign(row, structuredClone(patch), { updated_at: new Date().toISOString() });
  }

  private owns(row: SessionRow, owner: Owner) {
    return (
      (owner.userId && row.user_id === owner.userId) ||
      (!owner.userId && owner.guestId && row.guest_id === owner.guestId)
    );
  }

  async listSessions(owner: Owner, limit: number) {
    return [...this.sessions.values()]
      .filter((r) => this.owns(r, owner))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map((r) => structuredClone(r));
  }

  async countSessionsSince(owner: Owner, since: Date) {
    return [...this.sessions.values()].filter(
      (r) => this.owns(r, owner) && new Date(r.created_at) >= since,
    ).length;
  }

  async reassignGuestSessions(guestId: string, userId: string) {
    let n = 0;
    for (const r of this.sessions.values()) {
      if (r.guest_id === guestId && !r.user_id) {
        r.user_id = userId;
        n++;
      }
    }
    return n;
  }

  async addMessage(m: Omit<MessageRow, "id" | "created_at">) {
    const row = { ...m, id: this.seq++, created_at: new Date().toISOString() };
    this.messages.push(row);
    return row;
  }

  async listMessages(sessionId: string) {
    return this.messages.filter((m) => m.session_id === sessionId);
  }

  async addEvent(e: Omit<EventRow, "id" | "created_at">) {
    this.events.push({ ...e, id: this.seq++, created_at: new Date().toISOString() });
  }

  async listEvents(sessionId: string) {
    return this.events.filter((e) => e.session_id === sessionId);
  }

  async addSubmission(s: Omit<SubmissionRow, "id" | "created_at">) {
    const row = { ...s, id: this.seq++, created_at: new Date().toISOString() };
    this.submissions.push(row);
    return row;
  }

  async listSubmissions(sessionId: string) {
    return this.submissions.filter((s) => s.session_id === sessionId);
  }

  async consumeQuota(key: string, windowStart: Date, limit: number, amount = 1) {
    const k = `${key}|${windowStart.toISOString()}`;
    const current = this.counters.get(k) ?? 0;
    if (current + amount > limit) return false;
    this.counters.set(k, current + amount);
    return true;
  }

  async addSpend(day: string, usd: number) {
    const total = (this.spend.get(day) ?? 0) + usd;
    this.spend.set(day, total);
    return total;
  }

  async getSpend(day: string) {
    return this.spend.get(day) ?? 0;
  }
}
