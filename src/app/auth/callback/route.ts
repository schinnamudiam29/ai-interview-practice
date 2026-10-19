import { NextResponse } from "next/server";
import { readGuestId } from "@/lib/identity";
import { store } from "@/lib/store";
import { authEnabled, supabaseAuthClient } from "@/lib/supabase/server";

/** Magic-link landing: exchange the code for a session, then move any guest work into the account. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  if (!authEnabled() || !code) return NextResponse.redirect(new URL("/login?error=link", url.origin));

  const supabase = await supabaseAuthClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL("/login?error=link", url.origin));

  const guestId = await readGuestId();
  if (guestId) {
    try {
      await store().reassignGuestSessions(guestId, data.user.id);
    } catch (err) {
      console.error("guest migration failed", err);
    }
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
