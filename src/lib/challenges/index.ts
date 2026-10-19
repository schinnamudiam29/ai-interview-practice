import "server-only";
import { CHALLENGES, RUNNER_SOURCE } from "./bundle.generated";
import type { ChallengePackage, PublicChallenge } from "./types";

export { RUNNER_SOURCE };

export function getChallenge(slug: string): ChallengePackage | null {
  return CHALLENGES.find((c) => c.meta.slug === slug) ?? null;
}

export function listPublicChallenges(): PublicChallenge[] {
  return CHALLENGES.map(({ meta }) => ({
    slug: meta.slug,
    title: meta.title,
    summary: meta.summary,
    format: meta.format,
    language: meta.language,
    difficulty: meta.difficulty,
    estimatedMinutes: meta.estimatedMinutes,
    isDemo: meta.isDemo,
  }));
}

export function demoChallengeSlug(): string | null {
  return CHALLENGES.find((c) => c.meta.isDemo)?.meta.slug ?? null;
}

/** Paths a user may create or edit. Grading-only directories are off limits. */
export function isEditablePath(path: string): boolean {
  if (!/^[A-Za-z0-9_\-./]+$/.test(path)) return false;
  if (path.startsWith("/") || path.includes("..") || path.includes("//")) return false;
  if (path.startsWith("tests/hidden/") || path === "tests/hidden") return false;
  if (path.length > 200) return false;
  return true;
}
