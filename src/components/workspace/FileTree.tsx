"use client";

import { useState } from "react";

const PATH_RE = /^[A-Za-z0-9_\-./]+$/;

interface Props {
  paths: string[];
  starterPaths: Set<string>;
  active: string | null;
  readOnly: boolean;
  onOpen: (path: string) => void;
  onCreate: (path: string) => void;
  onDelete: (path: string) => void;
}

export function FileTree({ paths, starterPaths, active, readOnly, onOpen, onCreate, onDelete }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("tests/visible/test_my_cases.py");
  const [error, setError] = useState("");

  const groups = new Map<string, string[]>();
  for (const p of [...paths].sort()) {
    const dir = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir)!.push(p);
  }

  function create(e: React.FormEvent) {
    e.preventDefault();
    const p = name.trim();
    if (!PATH_RE.test(p) || p.includes("..") || p.startsWith("/") || p.endsWith("/")) {
      setError("Use letters, numbers, _ - . and / only.");
      return;
    }
    if (p.startsWith("tests/hidden")) {
      setError("That folder is reserved for grading.");
      return;
    }
    if (paths.includes(p)) {
      setError("That file already exists.");
      return;
    }
    onCreate(p);
    setAdding(false);
    setError("");
  }

  return (
    <nav aria-label="Files" className="flex h-full flex-col text-[13px]">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-semibold text-ink-soft">Files</span>
        {!readOnly && (
          <button onClick={() => setAdding((v) => !v)} className="text-ink-faint hover:text-ink" title="New file">
            + New
          </button>
        )}
      </div>
      {adding && (
        <form onSubmit={create} className="px-3 pb-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="New file path"
            className="w-full rounded border border-rule bg-surface px-2 py-1 font-mono text-[12px] outline-none focus:border-marker"
          />
          {error && <p className="mt-1 text-[12px] text-fail">{error}</p>}
          <p className="mt-1 text-[11px] text-ink-faint">Tests in tests/visible run when you click Run.</p>
        </form>
      )}
      <div className="flex-1 overflow-y-auto pb-3">
        {[...groups.entries()].map(([dir, files]) => (
          <div key={dir} className="mt-1">
            {dir && <div className="truncate px-3 py-1 font-mono text-[11.5px] text-ink-faint">{dir}/</div>}
            <ul>
              {files.map((p) => {
                const base = p.slice(p.lastIndexOf("/") + 1);
                const isActive = p === active;
                return (
                  <li key={p} className="group relative">
                    <button
                      onClick={() => onOpen(p)}
                      className={[
                        "block w-full truncate py-1 pr-7 text-left font-mono text-[12.5px]",
                        dir ? "pl-6" : "pl-3",
                        isActive ? "bg-marker-tint font-semibold text-marker-dark" : "text-ink hover:bg-rule-soft",
                      ].join(" ")}
                      title={p}
                    >
                      {base}
                    </button>
                    {!readOnly && !starterPaths.has(p) && !p.startsWith("tests/twist/") && (
                      <button
                        onClick={() => {
                          if (confirm(`Delete ${p}?`)) onDelete(p);
                        }}
                        aria-label={`Delete ${p}`}
                        className="absolute right-2 top-1 hidden text-ink-faint hover:text-fail group-hover:block"
                      >
                        ×
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
