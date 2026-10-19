import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { LIMITS } from "@/lib/config";
import { sessionSecret } from "@/lib/env";
import { store } from "@/lib/store";
import type { Owner } from "@/lib/store";
import { authEnabled, supabaseAuthClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/http";

const GUEST_COOKIE = "gid";

export interface Identity {
  userId: string | null;
  email: string | null;
  guestId: string | null;
  ipHash: string;
}

function sign(value: string): string {
  return createHmac("sha256", sessionSecret()).update(`guest:${value}`).digest("base64url");
}

export function verifyGuestCookie(raw: string | undefined): string | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return null;
  const id = raw.slice(0, dot);
  const given = Buffer.from(raw.slice(dot + 1));
  const expected = Buffer.from(sign(id));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

async function clientIpHash(): Promise<string> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return createHmac("sha256", sessionSecret()).update(`ip:${ip}`).digest("hex").slice(0, 32);
}

async function currentUser(): Promise<{ id: string; email: string | null } | null> {
  if (!authEnabled()) return null;
  const supabase = await supabaseAuthClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
}

/**
 * Who is making this request. Signed-in users are identified by Supabase auth;
 * everyone else by a signed, HTTP-only guest cookie. With `createGuest`, a new
 * guest identity is issued (subject to a per-IP daily limit).
 */
export async function getIdentity(opts: { createGuest?: boolean } = {}): Promise<Identity> {
  const [user, ipHash, jar] = await Promise.all([currentUser(), clientIpHash(), cookies()]);
  let guestId = verifyGuestCookie(jar.get(GUEST_COOKIE)?.value);

  if (!user && !guestId && opts.createGuest) {
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const recent = await store().countGuestsSince(ipHash, since);
    if (recent >= LIMITS.guest.sessionsPerIpPerDay) {
      throw new HttpError(429, "Too many guest sessions from your network today. Sign up free to keep practising.");
    }
    guestId = await store().createGuest(ipHash);
    jar.set(GUEST_COOKIE, `${guestId}.${sign(guestId)}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 24 * 3600,
    });
  }

  return { userId: user?.id ?? null, email: user?.email ?? null, guestId, ipHash };
}

export function ownerOf(identity: Identity): Owner {
  return identity.userId ? { userId: identity.userId } : { guestId: identity.guestId };
}

export async function readGuestId(): Promise<string | null> {
  const jar = await cookies();
  return verifyGuestCookie(jar.get(GUEST_COOKIE)?.value);
}
