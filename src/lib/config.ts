import "server-only";

/** Every limit the server enforces. The browser never decides any of these. */
export const LIMITS = {
  guest: {
    sessionsPerIpPerDay: 3,
    aiMessagesPerSession: 15,
    runsPerSession: 30,
  },
  free: {
    challengesPerWeek: 3,
    aiMessagesPerSession: 40,
    runsPerDay: 200,
  },
  /** Minimum gap between Run/Submit clicks, per identity. */
  runCooldownSeconds: 3,
  maxMessageChars: 4000,
  maxFileBytes: 64 * 1024,
  maxFiles: 40,
  maxTotalBytes: 256 * 1024,
  sandboxRunTimeoutMs: 20_000,
  maxOutputBytes: 64 * 1024,
  explanationMinChars: 40,
  explanationMaxChars: 4000,
} as const;

export const AI = {
  provider: (process.env.AI_PROVIDER ?? "gemini") as "gemini" | "mock",
  model: process.env.AI_MODEL ?? "gemini-3.1-flash-lite",
  /** USD per million tokens. Update when the provider changes prices. */
  pricing: {
    inputPerMillion: Number(process.env.AI_PRICE_INPUT_PER_M ?? 0.25),
    outputPerMillion: Number(process.env.AI_PRICE_OUTPUT_PER_M ?? 1.5),
  },
  timeoutMs: 20_000,
  maxOutputTokens: { interview: 1500, guided: 800 },
  /** Characters of chat history kept in context (oldest dropped first). */
  historyChars: 24_000,
  dailySpendCapUsd: Number(process.env.DAILY_SPEND_CAP_USD ?? 20),
} as const;

export const SANDBOX = {
  provider: (process.env.SANDBOX_PROVIDER ?? "e2b") as "e2b" | "local",
  template: process.env.E2B_TEMPLATE ?? "base",
  python: process.env.SANDBOX_PYTHON ?? "python3",
} as const;

export const STORE = (process.env.STORE_PROVIDER ?? "supabase") as "supabase" | "memory";
