import "server-only";
import { requireEnv } from "@/lib/env";
import { ModelError, type GenerateRequest, type GenerateResult, type ModelAdapter } from "./types";

interface GeminiPart {
  text?: string;
  thought?: boolean;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
  error?: { message?: string };
}

export class GeminiAdapter implements ModelAdapter {
  name = "gemini";

  constructor(private model: string) {}

  async generate(req: GenerateRequest, signal: AbortSignal): Promise<GenerateResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": requireEnv("GEMINI_API_KEY"),
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: req.messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.text }],
          })),
          generationConfig: {
            maxOutputTokens: req.maxOutputTokens,
            temperature: req.temperature ?? 0.4,
          },
        }),
      });
    } catch (err) {
      if (signal.aborted) throw new ModelError("timeout", "model request timed out");
      throw new ModelError("unavailable", `network error: ${(err as Error).message}`);
    }

    const body = (await res.json().catch(() => ({}))) as GeminiResponse;
    if (!res.ok) {
      const msg = body.error?.message ?? `HTTP ${res.status}`;
      if (res.status === 429) throw new ModelError("rate_limited", msg);
      if (res.status === 401 || res.status === 403) throw new ModelError("auth", msg);
      if (res.status === 400 || res.status === 404) throw new ModelError("bad_request", msg);
      throw new ModelError("unavailable", msg);
    }
    if (body.promptFeedback?.blockReason) {
      throw new ModelError("blocked", `prompt blocked: ${body.promptFeedback.blockReason}`);
    }

    const candidate = body.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
      .filter((p) => !p.thought && typeof p.text === "string")
      .map((p) => p.text)
      .join("")
      .trim();
    const usage = body.usageMetadata ?? {};
    if (!text) {
      throw new ModelError(
        candidate?.finishReason === "SAFETY" ? "blocked" : "unavailable",
        `empty response (${candidate?.finishReason ?? "no candidate"})`,
      );
    }
    return {
      text,
      inputTokens: usage.promptTokenCount ?? 0,
      outputTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
      finishReason: candidate?.finishReason ?? "STOP",
    };
  }
}
