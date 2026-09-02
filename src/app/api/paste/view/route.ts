import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { slug } = await request.json();
    if (!slug) {
      return NextResponse.json({ error: "slug required" }, { status: 400 });
    }
    const db = getDB();
    if (!db) {
      return NextResponse.json({ error: "db unavailable" }, { status: 500 });
    }
    await db.prepare("UPDATE slugs SET click_count = click_count + 1, updated_at = CURRENT_TIMESTAMP WHERE slug = ?").bind(slug).run();
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("paste view increment failed", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
