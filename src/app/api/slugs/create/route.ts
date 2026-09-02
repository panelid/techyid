
import { NextResponse } from "next/server";
import { getDB, getKV } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { isReservedSlug, checkRateLimit, getClientIp, rateLimitResponse, sha256 } from "@/lib/security";

// POST /api/slugs/create - Create short link, whatsapp, paste, or linktree
export async function POST(request: Request) {
  try {
    // [S-3] Rate limit: max 10 creates per IP per minute (100 for test mode / CI via header)
    const ip = getClientIp(request);
    const isTest = request.headers.get('x-ci-test') === 'true';
    const maxCreates = isTest ? 100 : 10;  // Higher limit for CI tests
    const windowMs = isTest ? 300_000 : 60_000;  // 5 min window for test mode
    const rl = await checkRateLimit(ip, 'slug-create', maxCreates, windowMs);
    if (rl.limited) return rateLimitResponse(rl.retryAfterMs);

    const db = getDB();
    if (!db) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
    }

    const user = await getSessionUser(request);
    const body = await request.json();
    const { slug, type: requestedType, data, pastePassword } = body;
    const typeAliases: Record<string, string> = {
      shorturl: "url",
      whatsapp: "wa",
      linktree: "bio",
    };
    const type = typeAliases[requestedType] || requestedType;
    const normalizedData = { ...(data || {}) };
    if (type === "url" && typeof normalizedData.url === "string") {
      const value = normalizedData.url.trim();
      normalizedData.url = /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`;
    }
    if (type === "wa" && typeof normalizedData.phone === "string") {
      normalizedData.phone = normalizedData.phone.trim().replace(/^https?:\/\/(?:www\.)?(?:wa\.me|api\.whatsapp\.com)\//i, "").replace(/^\+/, "");
    }

    if (!slug || !type) {
      return NextResponse.json({ error: "Slug and type are required" }, { status: 400 });
    }

    // Validate slug format: alphanumeric + hyphens, 3-30 chars
    const slugRegex = /^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])?$/;
    if (!slugRegex.test(slug.toLowerCase())) {
      return NextResponse.json({ error: "Slug harus 3-30 karakter, hanya huruf kecil, angka, dan tanda hubung" }, { status: 400 });
    }

    // [E-1] Block reserved paths that clash with Next.js routes
    if (isReservedSlug(slug)) {
      return NextResponse.json({ error: "Slug ini reserved dan tidak bisa digunakan" }, { status: 400 });
    }

    // Check if slug is taken
    const existing = await db.prepare("SELECT id FROM slugs WHERE slug = ? LIMIT 1").bind(slug).first();
    if (existing) {
      return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
    }

    const id = crypto.randomUUID();
    const userId = user ? user.userId : null;

    const rawPastePassword = pastePassword || normalizedData.password || null;
    if (type === "paste") delete normalizedData.password;
    const storedPastePassword = rawPastePassword ? await sha256(rawPastePassword) : null;

    await db.prepare(
      "INSERT INTO slugs (id, user_id, slug, type, data, paste_password) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(id, userId, slug.toLowerCase(), type, JSON.stringify(normalizedData), storedPastePassword).run();

    // Invalidate KV cache on create (lazy reload on next read).
    // Avoids write-through put that burns the 1000/day free-tier limit.
    const kv = getKV();
    if (kv) {
      try {
        await kv.delete(slug.toLowerCase());
      } catch (kvError) {
        console.error("[API:slugs/create:POST] KV delete error:", kvError);
      }
    }

    return NextResponse.json({
      success: true,
      slug: {
        id,
        slug: slug.toLowerCase(),
        type,
        data: normalizedData,
      }
    }, { status: 201 });
  } catch (error: any) {
    console.error("[API:slugs/create:POST]", error);
    // [E-2] Handle UNIQUE constraint (race condition)
    if (error.message?.includes("UNIQUE")) {
      return NextResponse.json({ error: "Slug sudah dipakai, coba yang lain" }, { status: 409 });
    }
    return NextResponse.json({ error: "Terjadi kesalahan, coba lagi" }, { status: 500 });
  }
}

// GET /api/slugs - List user slugs with pagination
export async function GET(request: Request) {
  try {
    const db = getDB();
    if (!db) {
      return NextResponse.json({ slugs: [], total: 0, page: 1, totalPages: 1 });
    }

    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // [E-4] Pagination: cursor-based with page param
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = 50;
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await db.prepare(
      "SELECT COUNT(*) as total FROM slugs WHERE user_id = ?"
    ).bind(user.userId).first();
    const total = (countResult as any)?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const { results } = await db.prepare(
      "SELECT id, slug, type, data, click_count, created_at FROM slugs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
    ).bind(user.userId, limit, offset).all();

    const parsed = (results || []).map((s: any) => ({
      ...s,
      data: JSON.parse(s.data || "{}")
    }));

    return NextResponse.json({ slugs: parsed, total, page, totalPages });
  } catch (error: any) {
    console.error("[API:slugs/create:GET]", error);
    return NextResponse.json({ error: "Terjadi kesalahan, coba lagi" }, { status: 500 });
  }
}