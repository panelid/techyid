
import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { hashPassword, verifyPassword, createSessionToken, setSessionCookie } from "@/lib/auth";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/security";

// POST /api/auth/register
export async function POST(request: Request) {
  try {
    console.log("[register] START");
    // [S-3] Rate limit: max 5 registrations per IP per minute
    const ip = getClientIp(request);
    console.log("[register] IP:", ip);
    // CI bypass: only honored when x-ci-test header present (API tests in GitHub Actions)
    const isCI = request.headers.get("x-ci-test") === "true";
    if (!isCI) {
      const rl = await checkRateLimit(ip, 'register', 5, 60_000);
      if (rl.limited) return rateLimitResponse(rl.retryAfterMs);
    }
    console.log("[register] Rate limit OK");

    const db = getDB();
    console.log("[register] DB:", !!db);
    if (!db) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
    }

    const body = await request.json();
    const { email, password, username, displayName } = body;
    console.log("[register] Body parsed, email:", email);

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    // [U-5] Password strength validation: min 8 chars, letters + numbers
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json({ error: "Password minimal 8 karakter dan harus mengandung kombinasi huruf dan angka" }, { status: 400 });
    }
    console.log("[register] Password validation OK");

    // Check if user exists
    const existing = await db.prepare("SELECT id FROM users WHERE email = ? LIMIT 1").bind(email).first();
    console.log("[register] User exists check:", !!existing);
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    console.log("[register] Hashing password...");
    const passwordHash = await hashPassword(password);
    console.log("[register] Password hashed");
    const userId = crypto.randomUUID();

    console.log("[register] Inserting user...");
    await db.prepare(
      "INSERT INTO users (id, email, username, password_hash, display_name) VALUES (?, ?, ?, ?, ?)"
    ).bind(userId, email, username || email.split("@")[0], passwordHash, displayName || "").run();
    console.log("[register] User inserted");

    console.log("[register] Creating session token...");
    const token = await createSessionToken({ userId, email, username: username || email.split("@")[0], isAdmin: false });
    console.log("[register] Session token created");
    
    const response = NextResponse.json({ success: true, user: { id: userId, email } });
    response.headers.set("Set-Cookie", setSessionCookie(token));
    
    return response;
  } catch (error: any) {
    console.error("[API:auth/register:POST] Error:", error?.message || String(error));
    console.error("[API:auth/register:POST] Stack:", error?.stack);
    if (error.message?.includes("UNIQUE")) {
      return NextResponse.json({ error: "Email atau username sudah terdaftar" }, { status: 409 });
    }
    return NextResponse.json({ error: "Terjadi kesalahan, coba lagi" }, { status: 500 });
  }
}