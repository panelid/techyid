import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { isReservedSlug } from "@/lib/security";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const slug = (url.searchParams.get("slug") || "").trim().toLowerCase();

    if (!slug) {
      return NextResponse.json({ available: false, reason: "empty" });
    }

    // Validate slug format: alphanumeric + hyphens, 3-30 chars
    const slugRegex = /^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])?$/;
    if (!slugRegex.test(slug)) {
      return NextResponse.json({
        available: false,
        reason: "format",
        message: "Slug harus 3-30 karakter, hanya huruf kecil, angka, dan tanda hubung",
      });
    }

    if (isReservedSlug(slug)) {
      return NextResponse.json({
        available: false,
        reason: "reserved",
        message: "Slug ini reserved dan tidak bisa digunakan",
      });
    }

    const db = getDB();
    if (!db) {
      return NextResponse.json({ available: false, reason: "db", message: "Database unavailable" });
    }

    const existing = await db.prepare("SELECT id FROM slugs WHERE slug = ? LIMIT 1").bind(slug).first();
    if (existing) {
      return NextResponse.json({
        available: false,
        reason: "taken",
        message: "Slug sudah dipakai",
      });
    }

    return NextResponse.json({ available: true, slug });
  } catch (e: any) {
    console.error("slug check failed", e);
    return NextResponse.json({ available: false, reason: "error", message: "Terjadi kesalahan" });
  }
}
