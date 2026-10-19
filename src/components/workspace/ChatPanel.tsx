"use client";

import { useEffect, useRef, useState } from "react";
import type { ViewMessage } from "@/lib/view-types";
import { Markdown } from "./Markdown";

const MAX_CHARS = 4000;

interface Props {
  messages: ViewMessage[];
  disabled: boolean;
  onSend: (text: string) => Promise<boolean>;
  sending: boolean;
  error: string | null;
}

export function ChatPanel({ messages, disabled, onSend, sending, error }: Props) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, sending]);

  async function send() {
    const t = text.trim();
    if (!t || sending || t.length > MAX_CHARS) return;
    const ok = await onSend(t);
    if (ok) setText("");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="text-sm leading-relaxed text-ink-soft">
            <p className="font-semibold text-ink">Use the assistant the way you would in the interview.</p>
            <p className="mt-2">
              It sees your current files and your last test run. It doesn&apos;t see the hidden tests. It can be
              wrong, so check what it tells you.
            </p>
            <p className="mt-3 text-ink-faint">Try: &ldquo;Walk me through how get_page builds the next cursor.&rdquo;</p>
          </div>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="ml-auto w-fit max-w-[88%] whitespace-pre-wrap rounded-lg bg-marker-tint px-3 py-2 text-sm">
              {m.content}
            </div>
          ) : (
            <div key={m.id} className="max-w-full">
              <Markdown>{m.content}</Markdown>
            </div>
          ),
        )}
        {sending && (
          <p className="flex items-center gap-2 text-sm text-ink-faint" role="status">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-marker" /> Thinking…
          </p>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-rule p-3">
        {error && (
          <p className="mb-2 text-[13px] text-fail" role="alert">
            {error}
          </p>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          disabled={disabled}
          rows={3}
          placeholder={disabled ? "The assistant is closed for this session." : "Ask the assistant… (Enter to send, Shift+Enter for a new line)"}
          aria-label="Message the assistant"
          className="w-full resize-none rounded-md border border-rule bg-surface px-3 py-2 text-sm outline-none focus:border-marker disabled:bg-paper"
        />
        <div className="mt-1.5 flex items-center justify-between text-[12px] text-ink-faint">
          <span className={text.length > MAX_CHARS ? "text-fail" : ""}>
            {text.length > MAX_CHARS * 0.8 ? `${text.length.toLocaleString()} / ${MAX_CHARS.toLocaleString()}` : ""}
          </span>
          <button
            onClick={() => void send()}
            disabled={disabled || sending || !text.trim() || text.length > MAX_CHARS}
            className="rounded-md bg-ink px-3 py-1 text-[13px] font-semibold text-white disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
