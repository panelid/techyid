import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { env } = getCloudflareContext() as any;
  const rk = env?.RESEND_API_KEY || "";
  return NextResponse.json({
    hasResend: !!rk,
    prefix: rk.slice(0, 8),
    len: rk.length,
    hasCfToken: !!env?.CF_API_TOKEN,
    hasSession: !!env?.SESSION_SECRET,
  });
}
