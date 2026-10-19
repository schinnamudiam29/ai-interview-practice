export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface GenerateRequest {
  system: string;
  messages: ChatTurn[];
  maxOutputTokens: number;
  temperature?: number;
}

export interface GenerateResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  finishReason: string;
}

export type ModelErrorKind = "timeout" | "rate_limited" | "unavailable" | "blocked" | "auth" | "bad_request";

export class ModelError extends Error {
  constructor(
    public kind: ModelErrorKind,
    message: string,
  ) {
    super(message);
  }
}

/** One adapter per provider. Swapping providers is a config change. */
export interface ModelAdapter {
  name: string;
  generate(req: GenerateRequest, signal: AbortSignal): Promise<GenerateResult>;
}
