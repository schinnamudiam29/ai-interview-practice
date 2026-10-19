import "server-only";
import { STORE } from "@/lib/config";
import { MemoryStore } from "./memory";
import { SupabaseStore } from "./supabase";
import type { Store } from "./types";

const globalForStore = globalThis as unknown as { __store?: Store };

export function store(): Store {
  if (!globalForStore.__store) {
    if (STORE === "memory" && process.env.VERCEL) {
      throw new Error("STORE_PROVIDER=memory is for local development only");
    }
    globalForStore.__store = STORE === "memory" ? new MemoryStore() : new SupabaseStore();
  }
  return globalForStore.__store;
}

export type * from "./types";
