
import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { checkRateLimit, getClientIp, rateLimitResponse, sha256 } from "@/lib/security";

// POST /api/paste/verify - Verify paste password
export async function POST(request: Request) {
  try {
    // [S-3] Rate limit: max 5 attempts per IP per minute (brute force protection)
    const ip = getClientIp(request);
    const rl = await checkRateLimit(ip, 'paste-verify', 5, 60_000);
    if (rl.limited) return rateLimitResponse(rl.retryAfterMs);

    const db = getDB();
    if (!db) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
    }

    const body = await request.json();
    const { slug, password } = body;

    if (!slug || !password) {
      return NextResponse.json({ error: "Slug and password required" }, { status: 400 });
    }

    const pasteData = await db.prepare("SELECT paste_password, data FROM slugs WHERE slug = ? AND type = 'paste' LIMIT 1").bind(slug).first();
    
    if (!pasteData) {
      return NextResponse.json({ error: "Paste not found" }, { status: 404 });
    }

    // [S-5] Hash input password before comparing with stored hash
    const inputHash = await sha256(password);
    if (pasteData.paste_password !== inputHash) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const parsed = JSON.parse(pasteData.data || "{}");

    return NextResponse.json({ 
      success: true, 
      content: parsed.content 
    });
  } catch (error: any) {
    console.error("[API:paste/verify:POST]", error);
    return NextResponse.json({ error: "Terjadi kesalahan, coba lagi" }, { status: 500 });
  }
}