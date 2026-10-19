export type TestStatus = "passed" | "failed" | "error" | "skipped";

export interface TestRecord {
  suite: string;
  name: string;
  status: TestStatus;
  message: string;
  ms: number;
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  errors: number;
  skipped: number;
}

export interface RunResult {
  summary: TestSummary | null;
  tests: TestRecord[];
  /** Program output with the runner's result line removed, truncated. */
  output: string;
  timedOut: boolean;
  durationMs: number;
  /** Set when the sandbox itself failed (not the user's code). */
  infraError?: string;
}

export interface SandboxRunner {
  run(files: Record<string, string>, suites: string[]): Promise<RunResult>;
}
