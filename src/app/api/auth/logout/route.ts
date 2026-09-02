import { NextResponse } from "next/server";
import { clearSessionCookie, invalidateSession, getSessionUser } from "@/lib/auth";

// [S-6] POST only — GET would be vulnerable to CSRF (img tag trick)
// [S-7] Invalidate session in DB before clearing cookie
export async function POST(request: Request) {
  // Extract token from cookie and invalidate in DB
  const cookieHeader = request.headers.get("cookie") || "";
  const sessionCookie = cookieHeader.split(";").find(c => c.trim().startsWith("session="));
  if (sessionCookie) {
    const eqIdx = sessionCookie.indexOf("=");
    const token = eqIdx >= 0 ? sessionCookie.substring(eqIdx + 1).trim() : "";
    if (token) {
      await invalidateSession(token);
    }
  }

  const response = NextResponse.json({ success: true });
  response.headers.set("Set-Cookie", clearSessionCookie());
  return response;
}
