import { NextResponse } from "next/server";
import type { Mode } from "@/lib/challenges/types";
import { assertSameOrigin, handler, readJson } from "@/lib/http";
import { getIdentity } from "@/lib/identity";
import { startSession } from "@/lib/sessions";

export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const body = await readJson<{ slug?: unknown; mode?: unknown }>(req, 4096);
  const slug = typeof body.slug === "string" ? body.slug : "";
  const mode: Mode = body.mode === "guided" ? "guided" : "interview";
  const identity = await getIdentity({ createGuest: true });
  const session = await startSession(identity, slug, mode);
  return NextResponse.json({ id: session.id }, { status: 201 });
});
