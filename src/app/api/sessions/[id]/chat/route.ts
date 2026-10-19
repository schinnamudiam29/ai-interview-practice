import { NextResponse } from "next/server";
import { assertSameOrigin, handler, readJson } from "@/lib/http";
import { getIdentity } from "@/lib/identity";
import { chat, loadOwnedSession } from "@/lib/sessions";

export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { id } = await ctx.params;
  const identity = await getIdentity();
  const { session, pkg } = await loadOwnedSession(id, identity);
  // Mode and policy come only from the stored session; anything else in the body is ignored.
  const body = await readJson<{ message?: unknown }>(req, 64 * 1024);
  return NextResponse.json(await chat(identity, session, pkg, body.message));
});
