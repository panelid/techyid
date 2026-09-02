// src/lib/db/index.ts
// Cloudflare D1 database binding via OpenNext

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { runMigrations } from "./migrations";

let migrationsRan = false;

export function getDB() {
  try {
    const { env } = getCloudflareContext();
    const db = (env as any).DB;
    if (db && !migrationsRan) {
      migrationsRan = true;
      runMigrations(db).catch((e) => console.error("[DB] migration error", e));
    }
    return db;
  } catch {
    // Fallback for local dev or non-OpenNext context
    try {
      return (globalThis as any).DB || (globalThis as any).process?.env?.DB;
    } catch {
      return null;
    }
  }
}

// Run migrations once per worker instance (idempotent CREATE/ALTER)
export async function getDBReady() {
  const db = getDB();
  if (!db) return null;
  if (!migrationsRan) {
    try {
      await runMigrations(db);
    } catch (e) {
      console.error("[DB] migration error", e);
    }
    migrationsRan = true;
  }
  return db;
}

export function getKV() {
  try {
    const { env } = getCloudflareContext();
    return (env as any).SLUGS;
  } catch {
    try {
      return (globalThis as any).SLUGS || (globalThis as any).process?.env?.SLUGS;
    } catch {
      return null;
    }
  }
}

export type Link = {
  id: string;
  user_id: string;
  slug: string;
  type: 'url' | 'wa' | 'bio' | 'paste';
  data: any;
  created_at: string;
  updated_at: string;
};

export type CustomDomain = {
  id: string;
  user_id: string;
  domain: string;
  is_verified: boolean;
  verification_token: string;
  verified_at?: string;
  created_at: string;
  updated_at: string;
};
