import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDB } from "@/lib/db";

export async function GET() {
  let env: Record<string, unknown> = {};
  try {
    env = getCloudflareContext().env as Record<string, unknown>;
  } catch {
    env = {};
  }

  const db = await getDB();

  return NextResponse.json({
    keys: Object.keys(env),
    has_db: !!db,
    has_session_secret: !!env.SESSION_SECRET,
    has_resend_api_key: !!env.RESEND_API_KEY,
    has_cf_api_token: Boolean(env.CF_API_TOKEN),
    has_cf_zone_id: Boolean(env.CF_ZONE_ID),
  });
}
