import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight text-ink">
      <span
        aria-hidden
        className="grid h-7 w-7 place-items-center rounded-md bg-ink font-mono text-[13px] font-semibold text-highlighter"
      >
        {"{}"}
      </span>
      {SITE_NAME}
    </Link>
  );
}

export function SiteHeader({ email, authEnabled }: { email: string | null; authEnabled: boolean }) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
      <Logo />
      <nav className="flex items-center gap-4 text-sm">
        {email ? (
          <>
            <span className="hidden text-ink-soft sm:inline">{email}</span>
            <form action="/auth/signout" method="post">
              <button className="font-medium text-ink-soft hover:text-ink">Sign out</button>
            </form>
          </>
        ) : authEnabled ? (
          <Link
            href="/login"
            className="rounded-md border border-rule bg-surface px-3 py-1.5 font-medium hover:border-ink-faint"
          >
            Sign in
          </Link>
        ) : null}
      </nav>
    </header>
  );
}
