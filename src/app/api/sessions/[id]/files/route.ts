import { NextResponse } from "next/server";
import { assertSameOrigin, handler, readJson } from "@/lib/http";
import { getIdentity } from "@/lib/identity";
import { loadOwnedSession, saveFiles } from "@/lib/sessions";

type Ctx = { params: Promise<{ id: string }> };

/** Autosave. Called every few seconds while the user edits. */
export const PUT = handler(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { id } = await ctx.params;
  const identity = await getIdentity();
  const { session } = await loadOwnedSession(id, identity);
  const body = await readJson<{ files?: unknown }>(req);
  await saveFiles(session, body.files);
  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
});
