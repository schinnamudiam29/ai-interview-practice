import { NextResponse } from "next/server";
import { assertSameOrigin, handler, readJson } from "@/lib/http";
import { getIdentity } from "@/lib/identity";
import { buildView, loadOwnedSession, saveExplanation } from "@/lib/sessions";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { id } = await ctx.params;
  const identity = await getIdentity();
  const { session } = await loadOwnedSession(id, identity);
  const body = await readJson<{ text?: unknown }>(req, 16 * 1024);
  await saveExplanation(session, body.text);
  const fresh = await loadOwnedSession(id, identity);
  return NextResponse.json(await buildView(fresh.session, fresh.pkg, identity));
});
