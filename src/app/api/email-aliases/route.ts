import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const db = getDB();
    const user = await getSessionUser(request);
    if (!db) return NextResponse.json({ aliases: [] });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { results } = await db
      .prepare("SELECT id, local_part, domain, is_default, created_at FROM email_aliases WHERE user_id = ? ORDER BY is_default DESC, created_at DESC")
      .bind(user.userId)
      .all();

    return NextResponse.json({ aliases: results || [] });
  } catch (error: any) {
    console.error("[API:email-aliases:GET]", error);
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = getDB();
    const user = await getSessionUser(request);
    if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { local_part, domain, is_default } = await request.json();

    // Validate local part
    const lp = String(local_part || "").trim().toLowerCase();
    if (!lp || !/^[a-z0-9._-]+$/.test(lp) || lp.length > 64) {
      return NextResponse.json({ error: "Nama lokal tidak valid. Gunakan huruf, angka, titik, dash." }, { status: 400 });
    }

    // Validate domain: must be x.door.id OR a custom domain owned by user (is_verified = email routing active)
    // Alias = sender identity. Receiving works as long as email routing is active.
    // Sending from that alias only works if Resend verified (checked separately at send time).
    const dom = String(domain || "").trim().toLowerCase();
    const isPlatformDomain = dom === "x.door.id";
    let isOwnedDomain = false;

    if (!isPlatformDomain) {
      const owned: any = await db
        .prepare("SELECT id FROM custom_domains WHERE user_id = ? AND domain = ? AND is_verified = 1 LIMIT 1")
        .bind(user.userId, dom)
        .first();
      isOwnedDomain = !!owned;
    }

    if (!isPlatformDomain && !isOwnedDomain) {
      return NextResponse.json({ error: "Domain tidak valid atau belum terverifikasi" }, { status: 400 });
    }

    // Check duplicate
    const existing: any = await db
      .prepare("SELECT id FROM email_aliases WHERE user_id = ? AND local_part = ? AND domain = ? LIMIT 1")
      .bind(user.userId, lp, dom)
      .first();
    if (existing) {
      return NextResponse.json({ error: "Alias sudah ada" }, { status: 409 });
    }

    const id = crypto.randomUUID();

    // If setting as default, unset other defaults first
    if (is_default) {
      await db.prepare("UPDATE email_aliases SET is_default = 0 WHERE user_id = ?").bind(user.userId).run();
    }

    // If this is the user's first alias, make it default automatically
    const count: any = await db.prepare("SELECT COUNT(*) as c FROM email_aliases WHERE user_id = ?").bind(user.userId).first();
    const makeDefault = is_default || (count?.c || 0) === 0;

    await db
      .prepare("INSERT INTO email_aliases (id, user_id, local_part, domain, is_default) VALUES (?, ?, ?, ?, ?)")
      .bind(id, user.userId, lp, dom, makeDefault ? 1 : 0)
      .run();

    return NextResponse.json({ success: true, alias: { id, local_part: lp, domain: dom, is_default: makeDefault } }, { status: 201 });
  } catch (error: any) {
    console.error("[API:email-aliases:POST]", error);
    return NextResponse.json({ error: error?.message || "Gagal menambah alias" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const db = getDB();
    const user = await getSessionUser(request);
    if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });

    await db.prepare("DELETE FROM email_aliases WHERE id = ? AND user_id = ?").bind(id, user.userId).run();

    // If deleted was default, promote the most recent remaining alias
    const defaultCount: any = await db.prepare("SELECT COUNT(*) as c FROM email_aliases WHERE user_id = ? AND is_default = 1").bind(user.userId).first();
    if ((defaultCount?.c || 0) === 0) {
      const latest: any = await db.prepare("SELECT id FROM email_aliases WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").bind(user.userId).first();
      if (latest) {
        await db.prepare("UPDATE email_aliases SET is_default = 1 WHERE id = ?").bind(latest.id).run();
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API:email-aliases:DELETE]", error);
    return NextResponse.json({ error: "Gagal menghapus alias" }, { status: 500 });
  }
}
