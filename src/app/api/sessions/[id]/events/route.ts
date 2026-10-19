import { NextResponse } from "next/server";
import { assertSameOrigin, handler, readJson } from "@/lib/http";
import { getIdentity } from "@/lib/identity";
import { loadOwnedSession, logClientEvent } from "@/lib/sessions";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { id } = await ctx.params;
  const identity = await getIdentity();
  const { session } = await loadOwnedSession(id, identity);
  const body = await readJson<{ type?: unknown; data?: unknown }>(req, 4096);
  await logClientEvent(session, body.type, body.data);
  return NextResponse.json({ ok: true });
});
