import "server-only";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const isProduction = process.env.VERCEL_ENV === "production";

/** Used to sign guest cookies and hash IPs. Must be set in every deployed environment. */
export function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.VERCEL) throw new Error("SESSION_SECRET must be set (32+ chars)");
  return "dev-only-insecure-session-secret-change-me-please";
}
