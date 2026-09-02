import { NextResponse } from "next/server";
import { getDB, getKV } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { sha256 } from "@/lib/security";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDB();
    if (!db) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
    }

    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    // Verify ownership and get slug for KV deletion
    const slugData = await db.prepare("SELECT id, slug, user_id FROM slugs WHERE id = ? LIMIT 1").bind(id).first();
    if (!slugData || slugData.user_id !== user.userId) {
      return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
    }

    await db.prepare("DELETE FROM slugs WHERE id = ?").bind(id).run();

    // [P-1] Invalidate KV cache (best-effort; D1 is source of truth)
    const kv = getKV();
    if (kv && slugData.slug) {
      try {
        await kv.delete(slugData.slug);
      } catch (e) {
        console.error("[API:slugs/[id]:DELETE:KV]", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API:slugs/[id]:DELETE]", error);
    return NextResponse.json({ error: "Terjadi kesalahan, coba lagi" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDB();
    if (!db) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
    }

    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    // Verify ownership and get slug for KV update
    const slugData = await db.prepare("SELECT id, slug, user_id FROM slugs WHERE id = ? LIMIT 1").bind(id).first();
    if (!slugData || slugData.user_id !== user.userId) {
      return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
    }

    const body = await request.json();
    const { data, pastePassword } = body;

    const storedPastePassword = pastePassword !== undefined ? await sha256(pastePassword) : null;

    // Update data and/or password, keeping slug unchanged
    await db.prepare(
      "UPDATE slugs SET data = COALESCE(?, data), paste_password = COALESCE(?, paste_password), updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(
      data ? JSON.stringify(data) : null,
      storedPastePassword,
      id
    ).run();

    // Invalidate KV cache on update (lazy reload on next read).
    const kv = getKV();
    if (kv && slugData.slug) {
      try {
        await kv.delete(slugData.slug);
      } catch (e) {
        console.error("[API:slugs/[id]:PATCH:KV]", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API:slugs/[id]:PATCH]", error);
    return NextResponse.json({ error: "Terjadi kesalahan, coba lagi" }, { status: 500 });
  }
}
