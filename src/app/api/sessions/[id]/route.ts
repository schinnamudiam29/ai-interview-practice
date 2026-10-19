import { NextResponse } from "next/server";
import { handler } from "@/lib/http";
import { getIdentity } from "@/lib/identity";
import { buildView, loadOwnedSession } from "@/lib/sessions";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const identity = await getIdentity();
  const { session, pkg } = await loadOwnedSession(id, identity);
  return NextResponse.json(await buildView(session, pkg, identity));
});
