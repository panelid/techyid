import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const rk = process.env.RESEND_API_KEY || "";
  return NextResponse.json({
    hasResend: !!rk,
    prefix: rk.slice(0, 10),
    len: rk.length,
    fromEnv: !!process.env.CF_API_TOKEN,
  });
}
