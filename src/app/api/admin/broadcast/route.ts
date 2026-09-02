import { NextRequest, NextResponse } from "next/server";
import { getAdminFromCookies, logAdminAction } from "@/lib/auth/admin";
import { getDB } from "@/lib/db";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function POST(req: NextRequest) {
  try {
    const { env } = getCloudflareContext() as any;
    const resendKey = process.env.RESEND_API_KEY || env?.RESEND_API_KEY;
    const admin = await getAdminFromCookies();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const db = getDB();
    if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
    if (!resendKey) return NextResponse.json({ error: "RESEND_API_KEY missing" }, { status: 500 });

    const body = await req.json();
    const { subject, html, limit } = body;
    if (!subject || !html) return NextResponse.json({ error: "subject & html required" }, { status: 400 });

    // Fetch users (respect optional limit for testing)
    const lim = Math.min(parseInt(limit || "0") || 1_000_000, 1_000_000);
    const users = await db
      .prepare("SELECT email FROM users WHERE email IS NOT NULL AND email != '' LIMIT ?")
      .bind(lim)
      .all();
    const emails = ((users.results || []) as any[]).map((u) => u.email).filter(Boolean);
    if (emails.length === 0) return NextResponse.json({ error: "No recipients" }, { status: 400 });

    // Send in batches of 50 (Resend accepts array of to: up to 50)
    let sent = 0;
    let failed = 0;
    let lastErr: string | null = null;
    const BATCH = 50;
    for (let i = 0; i < emails.length; i += BATCH) {
      const batch = emails.slice(i, i + BATCH);
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `*** ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: "noreply@techy.id", to: batch, subject, html }),
        });
        if (res.ok) { sent += batch.length; }
        else {
          failed += batch.length;
          const errText = await res.text().catch(() => "");
          console.error("[broadcast] batch failed:", errText);
          lastErr = errText;
        }
      } catch (e: any) {
        failed += batch.length;
        lastErr = e?.message || "fetch error";
      }
    }

    // Record broadcast
    const bcId = crypto.randomUUID();
    await db
      .prepare("INSERT INTO broadcasts (id, subject, html, recipient_count, sent_by) VALUES (?, ?, ?, ?, ?)")
      .bind(bcId, subject, html, sent, admin.userId)
      .run();
    await logAdminAction(admin.userId, "broadcast", "all_users", null, `subject=${subject}, sent=${sent}`);

    if (failed > 0 && sent === 0) return NextResponse.json({ success: false, sent, failed, total: emails.length, error: lastErr || "all batches failed" }, { status: 502 });
    return NextResponse.json({ success: true, sent, failed, total: emails.length });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
