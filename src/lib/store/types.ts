import type { Mode } from "@/lib/challenges/types";

export type SessionStatus = "active" | "twist" | "explain" | "completed";

export interface Owner {
  userId?: string | null;
  guestId?: string | null;
}

export interface SessionRow {
  id: string;
  user_id: string | null;
  guest_id: string | null;
  challenge_slug: string;
  challenge_version: string;
  mode: Mode;
  status: SessionStatus;
  files: Record<string, string>;
  explanation: string | null;
  hints_unlocked: number;
  created_at: string;
  updated_at: string;
  twist_unlocked_at: string | null;
  completed_at: string | null;
}

export interface MessageRow {
  id: number;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  label: string | null;
  blocked: boolean;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  created_at: string;
}

export interface EventRow {
  id: number;
  session_id: string;
  type: string;
  data: Record<string, unknown>;
  created_at: string;
}

export interface SubmissionRow {
  id: number;
  session_id: string;
  stage: "main" | "twist";
  passed: number;
  total: number;
  results: unknown;
  created_at: string;
}

export type NewSession = Pick<
  SessionRow,
  "user_id" | "guest_id" | "challenge_slug" | "challenge_version" | "mode" | "files"
>;

export type SessionPatch = Partial<
  Pick<
    SessionRow,
    "status" | "files" | "explanation" | "hints_unlocked" | "twist_unlocked_at" | "completed_at" | "user_id"
  >
>;

export interface Store {
  createGuest(ipHash: string): Promise<string>;
  countGuestsSince(ipHash: string, since: Date): Promise<number>;

  createSession(input: NewSession): Promise<SessionRow>;
  getSession(id: string): Promise<SessionRow | null>;
  updateSession(id: string, patch: SessionPatch): Promise<void>;
  listSessions(owner: Owner, limit: number): Promise<SessionRow[]>;
  countSessionsSince(owner: Owner, since: Date): Promise<number>;
  reassignGuestSessions(guestId: string, userId: string): Promise<number>;

  addMessage(m: Omit<MessageRow, "id" | "created_at">): Promise<MessageRow>;
  listMessages(sessionId: string): Promise<MessageRow[]>;

  addEvent(e: Omit<EventRow, "id" | "created_at">): Promise<void>;
  listEvents(sessionId: string): Promise<EventRow[]>;

  addSubmission(s: Omit<SubmissionRow, "id" | "created_at">): Promise<SubmissionRow>;
  listSubmissions(sessionId: string): Promise<SubmissionRow[]>;

  /** Atomically add `amount` to a counter unless it would exceed `limit`. */
  consumeQuota(key: string, windowStart: Date, limit: number, amount?: number): Promise<boolean>;
  addSpend(day: string, usd: number): Promise<number>;
  getSpend(day: string): Promise<number>;
}
