import { NextResponse } from "next/server";
import { assertSameOrigin, handler, readJson } from "@/lib/http";
import { getIdentity } from "@/lib/identity";
import { buildView, loadOwnedSession, submit } from "@/lib/sessions";

export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { id } = await ctx.params;
  const identity = await getIdentity();
  const { session, pkg } = await loadOwnedSession(id, identity);
  const body = await readJson<{ files?: unknown }>(req);
  const result = await submit(identity, session, pkg, body.files);
  const fresh = await loadOwnedSession(id, identity);
  return NextResponse.json({ result, session: await buildView(fresh.session, fresh.pkg, identity) });
});
