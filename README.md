# Practice Round

Rehearsal for AI-assisted coding interviews. Users debug a small multi-file Python codebase with an AI assistant beside them. They submit against hidden tests, handle a follow-up requirement, and then explain their work.

This repo is **Phase 1** of the build blueprint: the core workspace in Interview mode, guest sessions, email sign-in, sandboxed test runs, and one complete challenge.

## How it works

```
Browser (editor, chat, Run/Submit)        holds no keys, no policy
   │  session id only
   ▼
Next.js API routes (src/app/api)
   ├─ sessions.ts   mode + status fixed server-side, ownership checks
   ├─ ai/           generate() → provider adapter (Gemini, mock)
   ├─ sandbox/      fresh E2B microVM per run, no internet, no secrets
   └─ quota.ts      per-guest/user/IP limits + global daily spend cap
   ▼
Supabase Postgres (RLS on, no policies: only the server can read/write)
```

- **Hidden tests and reference solutions never leave the server.** `scripts/build-challenges.ts` bundles them into a `server-only` module. The build is checked so they don't appear in client bundles, and they are never put in the model's context.
- **Run** executes `tests/visible` (plus `tests/twist` once the follow-up is unlocked). **Submit** grades with the server's own copies of the hidden tests, in a sandbox that is destroyed afterwards.
- Every external service has a dev stand-in (`STORE_PROVIDER=memory`, `SANDBOX_PROVIDER=local`, `AI_PROVIDER=mock`), so the app runs with no accounts.

## Run locally

```bash
npm install
cp .env.example .env.local   # then set the three dev stand-ins at the top
npm run dev                  # http://localhost:3000
```

Checks:

```bash
npm test                     # unit tests
npm run typecheck
npm run verify:challenges    # starter fails, reference passes 3×
BASE_URL=http://localhost:3000 node scripts/smoke-test.mjs   # full session end to end
```

## Adding a challenge

Create `challenges/<slug>/` with:

| Path | Purpose | User sees | Model sees |
|---|---|---|---|
| `challenge.json` | title, format, suites, demo flag | metadata | no |
| `brief.md` | task description | yes | yes |
| `starter/` | codebase + `tests/visible` | yes | yes (current version) |
| `hidden/tests/hidden/` | grading tests | names only, after submit | **no** |
| `twist/twist.md`, `twist/tests/twist/` | follow-up requirement | after first submit | after first submit |
| `solution/` | reference fix (files overlay starter) | no | **no** |
| `hints.json` | 3-step hint ladder (Guided mode, Phase 2) | one at a time | unlocked only |
| `policy.json` | per-mode assistant policy | no | builds the system prompt |
| `rubric.json` | what the report scores (Phase 2) | summary | grader |

Tests use the standard library's `unittest`, so they run in the stock sandbox image with no installs. Run `npm run verify:challenges` before publishing.

## Deploying

Vercel (Next.js) and Supabase. Apply `supabase/migrations/0001_init.sql`, and set the variables in `.env.example` in Vercel. Keep `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `E2B_API_KEY` and `SESSION_SECRET` server-side; none of them use the `NEXT_PUBLIC_` prefix.
