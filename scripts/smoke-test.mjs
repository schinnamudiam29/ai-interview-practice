#!/usr/bin/env node
/**
 * End-to-end smoke test: plays one full session as a guest.
 *   BASE_URL=http://localhost:3000 node scripts/smoke-test.mjs
 * Works against local dev (memory store / local runner / mock AI) or a deployment.
 * Pass SKIP_CHAT=1 to avoid spending model calls.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SLUG = "order-history-pagination";
const root = new URL("..", import.meta.url).pathname;
let cookie = "";
let failures = 0;

function readTree(dir, base = dir, out = {}) {
  for (const name of readdirSync(dir)) {
    if (name === "__pycache__") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) readTree(full, base, out);
    else out[relative(base, full)] = readFileSync(full, "utf8");
  }
  return out;
}

async function call(method, path, body, { expect = 200, withCookie = true } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(withCookie && cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const set = res.headers.get("set-cookie");
  if (set && withCookie) cookie = set.split(";")[0];
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  const ok = Array.isArray(expect) ? expect.includes(res.status) : res.status === expect;
  return { ok, status: res.status, data };
}

function check(name, cond, detail = "") {
  console.log(`${cond ? "ok  " : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!cond) failures++;
}

const home = await call("GET", "/");
check("home page renders", home.status === 200 && String(home.data).includes("Rehearse"));

const created = await call("POST", "/api/sessions", { slug: SLUG, mode: "interview" }, { expect: 201 });
check("guest can start the demo challenge", created.status === 201, `status ${created.status}`);
const id = created.data.id;

const view = await call("GET", `/api/sessions/${id}`);
check("session view loads", view.status === 200 && view.data.status === "active");
check("view has no hidden tests", !Object.keys(view.data.files).some((p) => p.startsWith("tests/hidden")));
check("view leaks no solution", !JSON.stringify(view.data).includes("cursor was issued for a different order"));

const stranger = await call("GET", `/api/sessions/${id}`, null, { expect: 404, withCookie: false });
check("another visitor can't open the session", stranger.status === 404, `status ${stranger.status}`);

const starter = view.data.files;
const run1 = await call("POST", `/api/sessions/${id}/run`, { files: starter });
check(
  "starter run: visible tests reproduce the bug",
  run1.status === 200 && run1.data.summary && run1.data.summary.passed < run1.data.summary.total,
  run1.data.summary ? `${run1.data.summary.passed}/${run1.data.summary.total}` : JSON.stringify(run1.data).slice(0, 200),
);

const cooldown = await call("POST", `/api/sessions/${id}/run`, { files: starter }, { expect: 429 });
check("run cooldown enforced", cooldown.status === 429, `status ${cooldown.status}`);

const sneaky = await call("PUT", `/api/sessions/${id}/files`, { files: { ...starter, "tests/hidden/x.py": "" } }, { expect: 400 });
check("writing into tests/hidden is rejected", sneaky.status === 400, `status ${sneaky.status}`);

if (!process.env.SKIP_CHAT) {
  const chat = await call("POST", `/api/sessions/${id}/chat`, { message: "Why do orders go missing?", mode: "guided" });
  check("assistant replies", chat.status === 200 && chat.data.assistant?.content?.length > 0, chat.status === 200 ? chat.data.assistant.content.slice(0, 80).replace(/\n/g, " ") : JSON.stringify(chat.data));
  const flood = await call("POST", `/api/sessions/${id}/chat`, { message: "x".repeat(4001) }, { expect: 400 });
  check("oversized message rejected", flood.status === 400);
}

await new Promise((r) => setTimeout(r, 3200));
const sub1 = await call("POST", `/api/sessions/${id}/submit`, { files: starter });
check("submit (main) grades with hidden tests", sub1.status === 200 && sub1.data.result.kind === "submit", sub1.status === 200 ? `${sub1.data.result.summary.passed}/${sub1.data.result.summary.total} hidden` : JSON.stringify(sub1.data));
check("hidden test messages are withheld", sub1.status === 200 && sub1.data.result.tests.every((t) => t.message === ""));
check("twist unlocks", sub1.data.session?.status === "twist" && !!sub1.data.session?.twist);
const twistFiles = sub1.data.session.files;
check("twist tests join the workspace", Object.keys(twistFiles).some((p) => p.startsWith("tests/twist/")));

const solution = readTree(join(root, "challenges", SLUG, "solution"));
const fixed = { ...twistFiles, ...solution };
await new Promise((r) => setTimeout(r, 3200));
const run2 = await call("POST", `/api/sessions/${id}/run`, { files: fixed });
check("reference fix passes visible + twist tests", run2.data.summary?.passed === run2.data.summary?.total, `${run2.data.summary?.passed}/${run2.data.summary?.total}`);

await new Promise((r) => setTimeout(r, 3200));
const sub2 = await call("POST", `/api/sessions/${id}/submit`, { files: fixed });
check("submit (twist) all green", sub2.status === 200 && sub2.data.result.summary.passed === sub2.data.result.summary.total, sub2.status === 200 ? `${sub2.data.result.summary.passed}/${sub2.data.result.summary.total}` : JSON.stringify(sub2.data));
check("moves to explanation", sub2.data.session?.status === "explain");

const short = await call("POST", `/api/sessions/${id}/explanation`, { text: "fixed it" }, { expect: 400 });
check("too-short explanation rejected", short.status === 400);
const done = await call("POST", `/api/sessions/${id}/explanation`, {
  text: "Root cause: the cursor stored only created_at, so ties at a page boundary were skipped. I switched to a (created_at, id) key, fetch limit+1 to detect the last page, and normalise cursor errors to ValueError.",
});
check("session completes with a summary", done.status === 200 && done.data.status === "completed" && !!done.data.summary);

const locked = await call("PUT", `/api/sessions/${id}/files`, { files: fixed }, { expect: 409 });
check("finished session is read-only", locked.status === 409);

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
