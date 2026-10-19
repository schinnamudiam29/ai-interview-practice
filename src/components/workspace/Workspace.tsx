"use client";

import Editor, { loader, type OnMount } from "@monaco-editor/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SessionView, ViewMessage, ViewRun } from "@/lib/view-types";
import { api, ApiError } from "./api";
import { ChatPanel } from "./ChatPanel";
import { ExplainPanel } from "./ExplainPanel";
import { FileTree } from "./FileTree";
import { Markdown } from "./Markdown";
import { ResultsPanel } from "./ResultsPanel";
import { StageStrip } from "./StageStrip";
import { SummaryPanel } from "./SummaryPanel";

// Monaco is served from our own origin (copied in at build time), not a CDN.
loader.config({ paths: { vs: "/monaco/vs" } });

type SaveState = "saved" | "unsaved" | "saving" | "error";
type RightTab = "brief" | "assistant" | "explain" | "summary";

const AUTOSAVE_MS = 2500;
const LARGE_PASTE = 200;

function languageFor(path: string) {
  if (path.endsWith(".py")) return "python";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".json")) return "json";
  return "plaintext";
}

function defaultTab(status: SessionView["status"]): RightTab {
  if (status === "explain") return "explain";
  if (status === "completed") return "summary";
  return "brief";
}

export function Workspace({ initial }: { initial: SessionView }) {
  const [view, setView] = useState(initial);
  const [files, setFiles] = useState<Record<string, string>>(initial.files);
  const [openTabs, setOpenTabs] = useState<string[]>(() => {
    const first = initial.challenge.openFile && initial.files[initial.challenge.openFile] !== undefined
      ? initial.challenge.openFile
      : Object.keys(initial.files).sort()[0];
    return first ? [first] : [];
  });
  const [active, setActive] = useState<string | null>(openTabs[0] ?? null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [busy, setBusy] = useState<"run" | "submit" | null>(null);
  const [lastRun, setLastRun] = useState<ViewRun | null>(initial.lastRun);
  const [rightTab, setRightTab] = useState<RightTab>(defaultTab(initial.status));
  const [messages, setMessages] = useState<ViewMessage[]>(initial.messages);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const filesRef = useRef(files);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  const readOnly = view.status === "completed";
  const starterPaths = useMemo(() => new Set(view.starterPaths), [view.starterPaths]);
  const canSubmit = view.status === "active" || view.status === "twist";

  // ------------------------------------------------------------ saving

  const save = useCallback(
    async (opts: { keepalive?: boolean } = {}) => {
      if (!dirtyRef.current || readOnly) return;
      dirtyRef.current = false;
      setSaveState("saving");
      try {
        await api(`/api/sessions/${view.id}/files`, {
          method: "PUT",
          body: { files: filesRef.current },
          keepalive: opts.keepalive,
        });
        setSaveState(dirtyRef.current ? "unsaved" : "saved");
      } catch (err) {
        dirtyRef.current = true;
        setSaveState("error");
        setNotice(err instanceof Error ? err.message : "Couldn't save.");
      }
    },
    [view.id, readOnly],
  );

  const updateFiles = useCallback(
    (next: Record<string, string>) => {
      filesRef.current = next;
      dirtyRef.current = true;
      setFiles(next);
      setSaveState("unsaved");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void save(), AUTOSAVE_MS);
    },
    [save],
  );

  useEffect(() => {
    const flush = () => {
      if (dirtyRef.current) void save({ keepalive: true });
    };
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        flush();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [save]);

  // ------------------------------------------------------------ events

  const logEvent = useCallback(
    (type: string, data: Record<string, unknown>) => {
      void fetch(`/api/sessions/${view.id}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, data }),
      }).catch(() => {});
    },
    [view.id],
  );

  // ------------------------------------------------------------ files & tabs

  function openFile(path: string) {
    setOpenTabs((tabs) => (tabs.includes(path) ? tabs : [...tabs, path]));
    setActive(path);
    logEvent("file_open", { path });
  }

  function closeTab(path: string) {
    setOpenTabs((tabs) => {
      const next = tabs.filter((t) => t !== path);
      if (active === path) setActive(next[next.length - 1] ?? null);
      return next;
    });
  }

  function createFile(path: string) {
    const template = path.endsWith(".py") && path.includes("tests/")
      ? "import unittest\n\n\nclass MyCases(unittest.TestCase):\n    def test_something(self):\n        self.assertTrue(True)\n"
      : "";
    updateFiles({ ...filesRef.current, [path]: template });
    openFile(path);
    logEvent("file_create", { path });
  }

  function deleteFile(path: string) {
    const next = { ...filesRef.current };
    delete next[path];
    updateFiles(next);
    closeTab(path);
    logEvent("file_delete", { path });
  }

  const onMount: OnMount = (editor) => {
    editor.onDidPaste((e) => {
      const model = editor.getModel();
      if (!model) return;
      const chars = model.getValueInRange(e.range).length;
      if (chars >= LARGE_PASTE) logEvent("paste", { chars, path: activeRef.current });
    });
  };

  // ------------------------------------------------------------ run & submit

  const runTests = useCallback(async () => {
    if (busy) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setBusy("run");
    setNotice(null);
    try {
      const result = await api<ViewRun>(`/api/sessions/${view.id}/run`, {
        method: "POST",
        body: { files: filesRef.current },
      });
      dirtyRef.current = false;
      setSaveState("saved");
      setLastRun(result);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Couldn't run tests.");
    } finally {
      setBusy(null);
    }
  }, [busy, view.id]);

  async function doSubmit() {
    setConfirmSubmit(false);
    if (busy) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setBusy("submit");
    setNotice(null);
    try {
      const res = await api<{ result: ViewRun; session: SessionView }>(`/api/sessions/${view.id}/submit`, {
        method: "POST",
        body: { files: filesRef.current },
      });
      dirtyRef.current = false;
      setSaveState("saved");
      setLastRun(res.result);
      setView(res.session);
      filesRef.current = res.session.files;
      setFiles(res.session.files);
      setRightTab(defaultTab(res.session.status));
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Couldn't submit.");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void runTests();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runTests]);

  // ------------------------------------------------------------ chat & explanation

  async function sendChat(text: string): Promise<boolean> {
    setSending(true);
    setChatError(null);
    const optimistic: ViewMessage = { id: -Date.now(), role: "user", content: text, at: new Date().toISOString() };
    setMessages((m) => [...m, optimistic]);
    try {
      if (dirtyRef.current) await save();
      const res = await api<{ user: ViewMessage; assistant: ViewMessage }>(`/api/sessions/${view.id}/chat`, {
        method: "POST",
        body: { message: text },
      });
      setMessages((m) => [...m.filter((x) => x.id !== optimistic.id), res.user, res.assistant]);
      return true;
    } catch (err) {
      // The user message was stored server-side unless the request was rejected up front.
      const rejectedEarly = err instanceof ApiError && err.status !== 503;
      if (rejectedEarly) setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setChatError(err instanceof Error ? err.message : "The assistant didn't respond.");
      // Keep the draft if nothing was stored; clear it if the message is already in the history.
      return !rejectedEarly;
    } finally {
      setSending(false);
    }
  }

  async function submitExplanation(text: string): Promise<string | null> {
    try {
      const next = await api<SessionView>(`/api/sessions/${view.id}/explanation`, { method: "POST", body: { text } });
      setView(next);
      setRightTab("summary");
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Couldn't save your explanation.";
    }
  }

  // ------------------------------------------------------------ render

  const tabs: { id: RightTab; label: string }[] = [
    { id: "brief", label: view.twist ? "Brief + follow-up" : "Brief" },
    { id: "assistant", label: messages.length ? `Assistant (${messages.filter((m) => m.role === "user").length})` : "Assistant" },
    ...(view.status === "explain" ? [{ id: "explain" as const, label: "Explain" }] : []),
    ...(view.status === "completed" ? [{ id: "summary" as const, label: "Summary" }] : []),
  ];

  const saveLabel = { saved: "Saved", unsaved: "Unsaved", saving: "Saving…", error: "Not saved" }[saveState];

  return (
    <div className="flex h-dvh flex-col bg-paper">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-rule bg-surface px-3 py-2">
        <Link href="/" aria-label="All challenges" className="grid h-7 w-7 place-items-center rounded-md bg-ink font-mono text-[13px] font-semibold text-highlighter">
          {"{}"}
        </Link>
        <h1 className="max-w-[28ch] truncate text-sm font-bold" title={view.challenge.title}>
          {view.challenge.title}
        </h1>
        <StageStrip status={view.status} />
        <div className="ml-auto flex items-center gap-2">
          <span className={`text-[12px] ${saveState === "error" ? "text-fail" : "text-ink-faint"}`} role="status">
            {readOnly ? "Read-only" : saveLabel}
          </span>
          <button
            onClick={() => void runTests()}
            disabled={!!busy}
            title="Run visible tests (Ctrl/⌘ + Enter)"
            className="rounded-md border border-rule bg-surface px-3 py-1.5 text-sm font-semibold hover:border-ink-faint disabled:opacity-50"
          >
            {busy === "run" ? "Running…" : "Run tests"}
          </button>
          {canSubmit && (
            <div className="relative">
              <button
                onClick={() => setConfirmSubmit((v) => !v)}
                disabled={!!busy}
                className="rounded-md bg-marker px-3 py-1.5 text-sm font-semibold text-white hover:bg-marker-dark disabled:opacity-50"
              >
                {busy === "submit" ? "Grading…" : view.status === "active" ? "Submit fix" : "Submit follow-up"}
              </button>
              {confirmSubmit && (
                <div role="dialog" aria-label="Confirm submit" className="absolute right-0 top-10 z-20 w-72 rounded-lg border border-rule bg-surface p-3 text-sm shadow-lg">
                  <p className="leading-relaxed">
                    {view.status === "active"
                      ? "Hidden tests will grade your fix, then a follow-up requirement arrives. You can't resubmit this stage."
                      : "Hidden and follow-up tests will grade your code. After this you'll write a short explanation."}
                  </p>
                  <div className="mt-3 flex justify-end gap-2">
                    <button onClick={() => setConfirmSubmit(false)} className="rounded px-2 py-1 text-ink-soft hover:text-ink">
                      Keep working
                    </button>
                    <button onClick={() => void doSubmit()} className="rounded bg-marker px-3 py-1 font-semibold text-white">
                      Submit now
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {notice && (
        <div className="flex items-center justify-between gap-4 border-b border-fail/30 bg-fail-tint px-4 py-2 text-sm text-fail" role="alert">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-semibold">
            Dismiss
          </button>
        </div>
      )}

      <div className="px-4 py-2 text-[13px] text-ink-soft md:hidden">
        The workspace is built for a laptop or desktop screen.
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)_minmax(320px,400px)]">
        <aside className="hidden min-h-0 border-r border-rule bg-surface md:block">
          <FileTree
            paths={Object.keys(files)}
            starterPaths={starterPaths}
            active={active}
            readOnly={readOnly}
            onOpen={openFile}
            onCreate={createFile}
            onDelete={deleteFile}
          />
        </aside>

        <section className="flex min-h-[60vh] min-w-0 flex-col md:min-h-0">
          <div className="flex overflow-x-auto border-b border-rule bg-surface" role="tablist" aria-label="Open files">
            {openTabs.map((p) => (
              <div
                key={p}
                className={`flex shrink-0 items-center border-r border-rule-soft ${p === active ? "bg-paper" : ""}`}
              >
                <button
                  role="tab"
                  aria-selected={p === active}
                  onClick={() => setActive(p)}
                  className={`py-2 pl-3 pr-1 font-mono text-[12.5px] ${p === active ? "font-semibold text-ink" : "text-ink-soft"}`}
                  title={p}
                >
                  {p.slice(p.lastIndexOf("/") + 1)}
                </button>
                <button onClick={() => closeTab(p)} aria-label={`Close ${p}`} className="px-2 text-ink-faint hover:text-ink">
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            {active && files[active] !== undefined ? (
              <Editor
                path={active}
                language={languageFor(active)}
                value={files[active]}
                onChange={(v) => updateFiles({ ...filesRef.current, [active]: v ?? "" })}
                onMount={onMount}
                theme="vs"
                options={{
                  readOnly,
                  fontFamily: "JetBrains Mono, ui-monospace, monospace",
                  fontSize: 13.5,
                  lineHeight: 21,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  tabSize: 4,
                  insertSpaces: true,
                  renderWhitespace: "selection",
                  automaticLayout: true,
                  padding: { top: 10 },
                }}
                loading={<div className="p-4 text-sm text-ink-faint">Loading editor…</div>}
              />
            ) : (
              <div className="grid h-full place-items-center text-sm text-ink-faint">Open a file from the list.</div>
            )}
          </div>
          <div className="h-[34%] min-h-[150px] border-t border-rule bg-surface">
            <ResultsPanel run={lastRun} busy={busy} />
          </div>
        </section>

        <aside className="flex min-h-[70vh] flex-col border-l border-rule bg-surface md:min-h-0">
          <div className="flex border-b border-rule" role="tablist" aria-label="Side panel">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={rightTab === t.id}
                onClick={() => setRightTab(t.id)}
                className={`-mb-px border-b-2 px-4 py-2.5 text-sm ${
                  rightTab === t.id ? "border-ink font-semibold text-ink" : "border-transparent text-ink-soft hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            {rightTab === "brief" && (
              <div className="h-full overflow-y-auto px-4 py-4">
                {view.twist && (
                  <div className="mb-6 rounded-lg border border-marker/40 bg-marker-tint p-4">
                    <Markdown>{view.twist}</Markdown>
                  </div>
                )}
                <Markdown>{view.brief}</Markdown>
              </div>
            )}
            {rightTab === "assistant" && (
              <ChatPanel
                messages={messages}
                disabled={readOnly}
                onSend={sendChat}
                sending={sending}
                error={chatError}
              />
            )}
            {rightTab === "explain" && <ExplainPanel onSubmit={submitExplanation} />}
            {rightTab === "summary" && <SummaryPanel view={view} />}
          </div>
          {view.viewer.isGuest && view.viewer.authEnabled && (
            <p className="border-t border-rule px-4 py-2 text-[12px] text-ink-soft">
              You&apos;re practising as a guest.{" "}
              <a href="/login" className="font-semibold text-marker underline">
                Sign up free
              </a>{" "}
              to keep this session and unlock more challenges.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
