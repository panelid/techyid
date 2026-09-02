import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { verifyPassword, createSessionToken, setSessionCookie } from "@/lib/auth";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/security";

// POST /api/auth/login
export async function POST(request: Request) {
  try {
    // [S-3] Rate limit: max 5 login attempts per IP per minute
    const ip = getClientIp(request);
    // CI bypass: only honored when x-ci-test header present (API tests in GitHub Actions)
    const isCI = request.headers.get("x-ci-test") === "true";
    if (!isCI) {
      const rl = await checkRateLimit(ip, 'login', 5, 60_000);
      if (rl.limited) return rateLimitResponse(rl.retryAfterMs);
    }

    const db = getDB();
    if (!db) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await db.prepare("SELECT id, email, username, password_hash, is_admin FROM users WHERE email = ? LIMIT 1").bind(email).first();

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.password_hash as string);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = await createSessionToken({ 
      userId: user.id as string, 
      email: user.email as string, 
      username: user.username as string,
      isAdmin: !!(user as any).is_admin
    });
    
    const response = NextResponse.json({ 
      success: true, 
      user: { id: user.id, email: user.email, username: user.username } 
    });
    response.headers.set("Set-Cookie", setSessionCookie(token));
    
    return response;
  } catch (error: any) {
    console.error("[API:auth/login:POST]", error);
    return NextResponse.json({ error: "Terjadi kesalahan, coba lagi" }, { status: 500 });
  }
}
