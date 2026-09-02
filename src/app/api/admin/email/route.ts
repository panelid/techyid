import { NextRequest, NextResponse } from "next/server";
import { getAdminFromCookies } from "@/lib/auth/admin";
import { getDB } from "@/lib/db";
import { withCache } from "@/lib/adminCache";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminFromCookies();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const db = getDB();
    if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

    const [inbound, outbound, stats] = await withCache("email:recent", 20_000, async () =>
      Promise.all([
        db
          .prepare("SELECT id, from_addr, to_addr, subject, received_at, is_read FROM emails ORDER BY received_at DESC LIMIT 15")
          .all(),
        db
          .prepare("SELECT id, from_addr, to_addr, subject, status, created_at FROM sent_emails ORDER BY created_at DESC LIMIT 15")
          .all(),
        Promise.all([
          db.prepare("SELECT COUNT(*) c FROM emails").first(),
          db.prepare("SELECT COUNT(*) c FROM emails WHERE is_read = 0").first(),
          db.prepare("SELECT COUNT(*) c FROM sent_emails").first(),
          db.prepare("SELECT COUNT(*) c FROM sent_emails WHERE status = 'opened'").first(),
          db.prepare("SELECT COUNT(*) c FROM sent_emails WHERE created_at > datetime('now', '-1 day')").first(),
        ]),
      ]) as any[]
    );

    const inboundRows = (inbound.results || []) as any[];
    const outboundRows = (outbound.results || []) as any[];
    const st = stats as any[];
    const statsOut = {
      totalInbound: st[0]?.c ?? 0,
      unreadInbound: st[1]?.c ?? 0,
      totalOutbound: st[2]?.c ?? 0,
      openedOutbound: st[3]?.c ?? 0,
      sentLast24h: st[4]?.c ?? 0,
    };

    return NextResponse.json(
      { inbound: inboundRows, outbound: outboundRows, stats: statsOut },
      { headers: { "Cache-Control": "public, max-age=20" } }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
