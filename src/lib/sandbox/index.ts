import "server-only";
import { SANDBOX } from "@/lib/config";
import { E2BRunner } from "./e2b";
import { LocalRunner } from "./local";
import type { SandboxRunner } from "./types";

/** E2B bills ~$0.11/hour for the default 2 vCPU sandbox. */
export const SANDBOX_COST_PER_SECOND = 0.11 / 3600;

export function sandbox(): SandboxRunner {
  return SANDBOX.provider === "local" ? new LocalRunner() : new E2BRunner();
}

export type * from "./types";
