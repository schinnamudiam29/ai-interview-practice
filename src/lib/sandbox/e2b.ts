import "server-only";
import { randomBytes } from "node:crypto";
import { CommandExitError, Sandbox } from "e2b";
import { RUNNER_SOURCE } from "@/lib/challenges";
import { LIMITS, SANDBOX } from "@/lib/config";
import { requireEnv } from "@/lib/env";
import { parseRunnerOutput, truncate } from "./parse";
import type { RunResult, SandboxRunner } from "./types";

const PROJECT_DIR = "/home/user/project";

/**
 * Runs tests in a fresh E2B microVM: no internet, no secrets, killed after
 * every run. One sandbox per run keeps hidden tests away from anything the
 * user's code could read later.
 */
export class E2BRunner implements SandboxRunner {
  async run(files: Record<string, string>, suites: string[]): Promise<RunResult> {
    const started = Date.now();
    const nonce = randomBytes(8).toString("hex");
    const marker = `@@R${nonce}@@`;
    const runnerPath = `/tmp/runner_${nonce}.py`;
    let sandbox: Sandbox | null = null;

    try {
      sandbox = await Sandbox.create(SANDBOX.template, {
        apiKey: requireEnv("E2B_API_KEY"),
        timeoutMs: 90_000,
        allowInternetAccess: false,
      });
      await sandbox.files.write([
        ...Object.entries(files).map(([path, data]) => ({ path: `${PROJECT_DIR}/${path}`, data })),
        { path: runnerPath, data: RUNNER_SOURCE },
      ]);

      const cmd = [SANDBOX.python, "-I", runnerPath, marker, ...suites].map(shellQuote).join(" ");
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      try {
        const res = await sandbox.commands.run(cmd, {
          cwd: PROJECT_DIR,
          timeoutMs: LIMITS.sandboxRunTimeoutMs,
        });
        stdout = res.stdout;
        stderr = res.stderr;
      } catch (err) {
        if (err instanceof CommandExitError) {
          stdout = err.stdout;
          stderr = err.stderr;
        } else if (err instanceof Error && /timeout|timed out|deadline/i.test(err.name + err.message)) {
          timedOut = true;
        } else {
          throw err;
        }
      }

      const parsed = parseRunnerOutput(stdout, marker);
      const output = truncate([parsed.rest, stderr].filter(Boolean).join("\n"), LIMITS.maxOutputBytes);
      return {
        summary: parsed.summary,
        tests: parsed.tests,
        output: timedOut
          ? `${output}\nTests stopped after ${LIMITS.sandboxRunTimeoutMs / 1000}s. Is there an infinite loop?`.trim()
          : output,
        timedOut,
        durationMs: Date.now() - started,
      };
    } catch (err) {
      console.error("sandbox failure", err);
      return {
        summary: null,
        tests: [],
        output: "",
        timedOut: false,
        durationMs: Date.now() - started,
        infraError: "The code runner is unavailable right now. Your code is saved; try again in a moment.",
      };
    } finally {
      if (sandbox) await sandbox.kill().catch(() => {});
    }
  }
}

function shellQuote(s: string): string {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
}
