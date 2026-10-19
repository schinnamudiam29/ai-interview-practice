import "server-only";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { RUNNER_SOURCE } from "@/lib/challenges";
import { LIMITS, SANDBOX } from "@/lib/config";
import { parseRunnerOutput, truncate } from "./parse";
import type { RunResult, SandboxRunner } from "./types";

/**
 * DEVELOPMENT ONLY: runs user code directly on this machine with no isolation.
 * Refuses to run on Vercel. Production always uses E2B.
 */
export class LocalRunner implements SandboxRunner {
  async run(files: Record<string, string>, suites: string[]): Promise<RunResult> {
    if (process.env.VERCEL) throw new Error("LocalRunner must never run in a deployed environment");
    const started = Date.now();
    const dir = await mkdtemp(join(tmpdir(), "practice-run-"));
    const marker = `@@R${randomBytes(8).toString("hex")}@@`;
    try {
      for (const [path, data] of Object.entries(files)) {
        const full = join(dir, "project", path);
        await mkdir(dirname(full), { recursive: true });
        await writeFile(full, data);
      }
      const runnerPath = join(dir, "runner.py");
      await writeFile(runnerPath, RUNNER_SOURCE);

      const { stdout, stderr, timedOut } = await new Promise<{ stdout: string; stderr: string; timedOut: boolean }>(
        (resolve) => {
          const child = spawn(SANDBOX.python, ["-I", runnerPath, marker, ...suites], {
            cwd: join(dir, "project"),
            env: { PATH: process.env.PATH ?? "" } as unknown as NodeJS.ProcessEnv,
            stdio: ["ignore", "pipe", "pipe"],
          });
          let out = "";
          let err = "";
          let killed = false;
          const timer = setTimeout(() => {
            killed = true;
            child.kill("SIGKILL");
          }, LIMITS.sandboxRunTimeoutMs);
          child.stdout.on("data", (d) => (out += d));
          child.stderr.on("data", (d) => (err += d));
          child.on("close", () => {
            clearTimeout(timer);
            resolve({ stdout: out, stderr: err, timedOut: killed });
          });
        },
      );

      const parsed = parseRunnerOutput(stdout, marker);
      return {
        summary: parsed.summary,
        tests: parsed.tests,
        output: truncate([parsed.rest, stderr].filter(Boolean).join("\n"), LIMITS.maxOutputBytes),
        timedOut,
        durationMs: Date.now() - started,
      };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
