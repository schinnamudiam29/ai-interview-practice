import type { TestRecord, TestStatus, TestSummary } from "./types";

const STATUSES: TestStatus[] = ["passed", "failed", "error", "skipped"];

export function truncate(text: string, maxBytes: number): string {
  if (text.length <= maxBytes) return text;
  return text.slice(0, maxBytes) + `\n… output truncated (${text.length - maxBytes} more characters)`;
}

/**
 * Extract the runner's JSON result (the LAST line starting with `marker`) and
 * return it together with the remaining output. Never throws.
 */
export function parseRunnerOutput(
  stdout: string,
  marker: string,
): { summary: TestSummary | null; tests: TestRecord[]; rest: string } {
  const lines = stdout.split("\n");
  let resultIndex = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith(marker)) {
      resultIndex = i;
      break;
    }
  }
  const rest = lines.filter((l, i) => i !== resultIndex && !l.startsWith(marker)).join("\n").trim();
  if (resultIndex === -1) return { summary: null, tests: [], rest };

  try {
    const parsed = JSON.parse(lines[resultIndex].slice(marker.length));
    const tests: TestRecord[] = Array.isArray(parsed.tests)
      ? parsed.tests
          .filter((t: Record<string, unknown>) => STATUSES.includes(t.status as TestStatus))
          .map((t: Record<string, unknown>) => ({
            suite: String(t.suite ?? ""),
            name: String(t.name ?? ""),
            status: t.status as TestStatus,
            message: String(t.message ?? ""),
            ms: Number(t.ms ?? 0),
          }))
      : [];
    const count = (s: TestStatus) => tests.filter((t) => t.status === s).length;
    const summary: TestSummary = {
      total: tests.length,
      passed: count("passed"),
      failed: count("failed"),
      errors: count("error"),
      skipped: count("skipped"),
    };
    return { summary, tests, rest };
  } catch {
    return { summary: null, tests: [], rest };
  }
}
