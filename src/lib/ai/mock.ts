import type { GenerateRequest, GenerateResult, ModelAdapter } from "./types";

/** Offline stand-in for local development and tests. Never calls a network. */
export class MockAdapter implements ModelAdapter {
  name = "mock";

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const last = req.messages[req.messages.length - 1]?.text ?? "";
    const question = last.match(/<user_message>\n?([\s\S]*?)\n?<\/user_message>/)?.[1] ?? last;
    const files = [...last.matchAll(/<file path="([^"]+)"/g)].map((m) => m[1]);
    const text =
      `**[mock assistant]** I can see ${files.length} files (${files.slice(0, 4).join(", ")}${files.length > 4 ? ", …" : ""}).\n\n` +
      `You asked: "${question.slice(0, 200)}"\n\n` +
      "Set `AI_PROVIDER=gemini` and `GEMINI_API_KEY` to talk to a real model.";
    const chars = req.system.length + req.messages.reduce((n, m) => n + m.text.length, 0);
    return { text, inputTokens: Math.ceil(chars / 4), outputTokens: Math.ceil(text.length / 4), finishReason: "STOP" };
  }
}
