import "server-only";
import { AI } from "@/lib/config";
import { GeminiAdapter } from "./gemini";
import { MockAdapter } from "./mock";
import { ModelError, type GenerateRequest, type GenerateResult, type ModelAdapter } from "./types";

export { ModelError };
export type * from "./types";

function adapter(): ModelAdapter {
  if (AI.provider === "mock") {
    if (process.env.VERCEL_ENV === "production") throw new Error("mock AI provider in production");
    return new MockAdapter();
  }
  return new GeminiAdapter(AI.model);
}

export function estimateCostUsd(r: Pick<GenerateResult, "inputTokens" | "outputTokens">): number {
  return (
    (r.inputTokens * AI.pricing.inputPerMillion + r.outputTokens * AI.pricing.outputPerMillion) / 1_000_000
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function attempt(a: ModelAdapter, req: GenerateRequest): Promise<GenerateResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI.timeoutMs);
  try {
    return await a.generate(req, controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The single entry point for every model call. Times out after ~20s and
 * retries once on timeouts, outages and rate limits (with a short back-off).
 */
export async function generate(req: GenerateRequest): Promise<GenerateResult & { costUsd: number; provider: string }> {
  const a = adapter();
  let lastError: unknown;
  for (let i = 0; i < 2; i++) {
    try {
      const result = await attempt(a, req);
      return { ...result, costUsd: estimateCostUsd(result), provider: a.name };
    } catch (err) {
      lastError = err;
      const retryable = err instanceof ModelError && ["timeout", "unavailable", "rate_limited"].includes(err.kind);
      if (!retryable || i === 1) break;
      await sleep(err instanceof ModelError && err.kind === "rate_limited" ? 2000 : 300);
    }
  }
  throw lastError instanceof ModelError ? lastError : new ModelError("unavailable", String(lastError));
}
