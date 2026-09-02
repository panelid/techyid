import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { isReservedSlug, checkRateLimit, getClientIp, rateLimitResponse, sha256 } from "@/lib/security";

export async function POST(request: Request) {
  try {
    // [S-3] Rate limit: max 10 creates per IP per minute
    const ip = getClientIp(request);
    const rl = await checkRateLimit(ip, 'paste-create', 10, 60_000);
    if (rl.limited) return rateLimitResponse(rl.retryAfterMs);

    const db = getDB();
    if (!db) {
      return NextResponse.json({ success: false, error: "Database unavailable" }, { status: 500 });
    }

    const user = await getSessionUser(request);
    const body = await request.json();
    const { slug, content, password } = body;

    if (!slug || !content) {
      return NextResponse.json({ success: false, error: "Slug and content are required" }, { status: 400 });
    }

    // Validate slug format: alphanumeric + hyphens, 3-30 chars
    const slugRegex = /^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])?$/;
    if (!slugRegex.test(slug.toLowerCase())) {
      return NextResponse.json({ success: false, error: "Slug harus 3-30 karakter, hanya huruf kecil, angka, dan tanda hubung" }, { status: 400 });
    }

    // [E-1] Block reserved paths
    if (isReservedSlug(slug)) {
      return NextResponse.json({ success: false, error: "Slug ini reserved dan tidak bisa digunakan" }, { status: 400 });
    }

    // [E-6] Limit paste content to 100KB
    const MAX_PASTE_BYTES = 100 * 1024;
    const contentBytes = new TextEncoder().encode(content).byteLength;
    if (contentBytes > MAX_PASTE_BYTES) {
      return NextResponse.json({ success: false, error: `Konten terlalu besar (${(contentBytes/1024).toFixed(0)}KB). Maksimum 100KB.` }, { status: 400 });
    }

    // Check if slug is taken
    const existing = await db.prepare("SELECT id FROM slugs WHERE slug = ? LIMIT 1").bind(slug).first();
    if (existing) {
      return NextResponse.json({ success: false, error: "Slug already taken" }, { status: 409 });
    }

    const id = crypto.randomUUID();
    const userId = user ? user.userId : null;
    const type = "paste";
    const data = JSON.stringify({ content });

    // [S-5] Hash paste password before storing (never save plain text)
    const hashedPassword = password ? await sha256(password) : null;

    await db.prepare(
      "INSERT INTO slugs (id, user_id, slug, type, data, paste_password) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(id, userId, slug.toLowerCase(), type, data, hashedPassword).run();

    return NextResponse.json({
      success: true,
      slug: {
        id,
        slug: slug.toLowerCase(),
        type,
        data: { content }
      }
    }, { status: 201 });
  } catch (error: any) {
    console.error("[API:paste:POST]", error);
    if (error.message?.includes("UNIQUE")) {
      return NextResponse.json({ success: false, error: "Slug sudah dipakai, coba yang lain" }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: "Terjadi kesalahan, coba lagi" }, { status: 500 });
  }
}
