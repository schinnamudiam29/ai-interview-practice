/** Shapes sent to the browser. Nothing here may contain hidden tests or solutions. */

export type SessionStatus = "active" | "twist" | "explain" | "completed";

export interface ViewTest {
  suite: string;
  name: string;
  status: "passed" | "failed" | "error" | "skipped";
  message: string;
}

export interface ViewRun {
  kind: "run" | "submit";
  stage?: "main" | "twist";
  at: string;
  summary: { total: number; passed: number; failed: number; errors: number; skipped: number } | null;
  tests: ViewTest[];
  output: string;
  timedOut: boolean;
  infraError?: string;
}

export interface ViewMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  at: string;
}

export interface ViewSubmission {
  stage: "main" | "twist";
  passed: number;
  total: number;
  at: string;
}

export interface SessionSummary {
  minutes: number;
  runs: number;
  aiMessages: number;
  largePastes: number;
  firstRunAfterSec: number | null;
  firstAiAfterSec: number | null;
  firstGreenVisibleAfterSec: number | null;
  submissions: ViewSubmission[];
}

export interface SessionView {
  id: string;
  status: SessionStatus;
  mode: "interview" | "guided";
  challenge: { slug: string; title: string; difficulty: string; estimatedMinutes: number; openFile?: string };
  brief: string;
  twist: string | null;
  files: Record<string, string>;
  /** Paths shipped with the challenge (users may still edit them). */
  starterPaths: string[];
  messages: ViewMessage[];
  submissions: ViewSubmission[];
  lastRun: ViewRun | null;
  explanation: string | null;
  summary: SessionSummary | null;
  viewer: { isGuest: boolean; email: string | null; authEnabled: boolean };
}
