import { NextResponse } from "next/server";
import { assertSameOrigin, handler } from "@/lib/http";
import { authEnabled, supabaseAuthClient } from "@/lib/supabase/server";

export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  if (authEnabled()) {
    const supabase = await supabaseAuthClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
});
