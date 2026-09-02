import { NextResponse } from "next/server";
import { getAdminFromCookies } from "@/lib/auth/admin";
import { getDB } from "@/lib/db";

export async function GET() {
  try {
    const admin = await getAdminFromCookies();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const db = getDB();
    if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

    const q = async (sql: string) => {
      const r = await db.prepare(sql).all();
      return (r.results || []) as any[];
    };

    const count = async (sql: string): Promise<number> => {
      const rows = await q(sql);
      return rows[0]?.c ?? 0;
    };

    const [
      totalUsers,
      adminUsers,
      totalLinks,
      totalClicks,
      totalDomains,
      verifiedDomains,
      totalInbound,
      unreadInbound,
      totalOutbound,
      sentOutbound,
      openedOutbound,
      totalAliases,
    ] = await Promise.all([
      count("SELECT COUNT(*) c FROM users"),
      count("SELECT COUNT(*) c FROM users WHERE is_admin = 1"),
      count("SELECT COUNT(*) c FROM slugs"),
      count("SELECT COALESCE(SUM(click_count),0) c FROM slugs"),
      count("SELECT COUNT(*) c FROM custom_domains"),
      count("SELECT COUNT(*) c FROM custom_domains WHERE is_verified = 1"),
      count("SELECT COUNT(*) c FROM emails"),
      count("SELECT COUNT(*) c FROM emails WHERE is_read = 0"),
      count("SELECT COUNT(*) c FROM sent_emails"),
      count("SELECT COUNT(*) c FROM sent_emails WHERE status = 'sent'"),
      count("SELECT COUNT(*) c FROM sent_emails WHERE status = 'opened'"),
      count("SELECT COUNT(*) c FROM email_aliases"),
    ]);

    // Top links by click
    const topLinks = await q(
      "SELECT slug, type, click_count FROM slugs ORDER BY click_count DESC LIMIT 10"
    );

    // Recent users
    const recentUsers = await q(
      "SELECT id, email, username, created_at FROM users ORDER BY created_at DESC LIMIT 10"
    );

    // Recent outbound emails
    const recentSent = await q(
      "SELECT id, from_addr, to_addr, subject, status, created_at FROM sent_emails ORDER BY created_at DESC LIMIT 10"
    );

    return NextResponse.json({
      stats: {
        totalUsers,
        adminUsers,
        totalLinks,
        totalClicks,
        totalDomains,
        verifiedDomains,
        totalInbound,
        unreadInbound,
        totalOutbound,
        sentOutbound,
        openedOutbound,
        totalAliases,
      },
      topLinks,
      recentUsers,
      recentSent,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
