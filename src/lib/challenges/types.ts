export type Mode = "interview" | "guided";

export interface ChallengeMeta {
  slug: string;
  title: string;
  summary: string;
  format: "debug" | "extend" | "review" | "test";
  language: "python";
  difficulty: "easy" | "medium" | "hard";
  estimatedMinutes: number;
  isDemo?: boolean;
  openFile?: string;
  suites: { visible: string[]; hidden: string[]; twist: string[] };
  trap?: string;
}

export interface Hint {
  id: string;
  text: string;
}

export interface Policy {
  mode: Mode;
  allow: string[];
  deny: string[];
  max_code_lines_per_reply: number;
  max_messages: number;
  hint_ladder?: string[];
  help_budget?: number;
}

export interface ChallengePackage {
  meta: ChallengeMeta;
  version: string;
  brief: string;
  twist: string;
  starter: Record<string, string>;
  hidden: Record<string, string>;
  twistTests: Record<string, string>;
  solution: Record<string, string>;
  hints: Hint[];
  policy: Record<Mode, Policy>;
  rubric: unknown;
}

/** What the browser is allowed to know about a challenge. */
export type PublicChallenge = Pick<
  ChallengeMeta,
  "slug" | "title" | "summary" | "format" | "language" | "difficulty" | "estimatedMinutes" | "isDemo"
>;
