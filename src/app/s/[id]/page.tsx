import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Workspace } from "@/components/workspace/Workspace";
import { HttpError } from "@/lib/http";
import { getIdentity } from "@/lib/identity";
import { buildView, loadOwnedSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Workspace" };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const identity = await getIdentity();
  try {
    const { session, pkg } = await loadOwnedSession(id, identity);
    const view = await buildView(session, pkg, identity);
    return <Workspace initial={view} />;
  } catch (err) {
    if (err instanceof HttpError && (err.status === 404 || err.status === 410)) notFound();
    throw err;
  }
}
