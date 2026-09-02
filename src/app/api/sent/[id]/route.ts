import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDB();
    const user = await getSessionUser(request);
    if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const email: any = await db
      .prepare(
        "SELECT s.id, s.from_addr, s.to_addr, s.subject, s.body, s.status, s.created_at, s.opened_at, s.clicked_at, s.resend_id, " +
        "(SELECT hit_count FROM email_tracking t WHERE t.sent_email_id = s.id) AS hit_count, " +
        "(SELECT last_hit_at FROM email_tracking t WHERE t.sent_email_id = s.id) AS last_hit_at, " +
        "(SELECT click_count FROM email_tracking t WHERE t.sent_email_id = s.id) AS click_count " +
        "FROM sent_emails s WHERE s.id = ? AND s.user_id = ? LIMIT 1"
      )
      .bind(id, user.userId)
      .first();
    if (!email) return NextResponse.json({ error: "Email not found" }, { status: 404 });

    return NextResponse.json({
      email: {
        id: email.id,
        to_addr: email.to_addr,
        from_addr: email.from_addr,
        subject: email.subject,
        body: email.body || "",
        status: email.status,
        created_at: email.created_at,
        opened_at: email.opened_at,
        resend_id: email.resend_id,
      },
    });
  } catch (error: any) {
    console.error("[API:sent:GET]", error);
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDB();
    const user = await getSessionUser(request);
    if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const email: any = await db
      .prepare("SELECT id FROM sent_emails WHERE id = ? AND user_id = ? LIMIT 1")
      .bind(id, user.userId)
      .first();
    if (!email) return NextResponse.json({ error: "Email not found" }, { status: 404 });

    // Delete tracking rows first (FK), then sent email
    await db.prepare("DELETE FROM email_tracking WHERE sent_email_id = ?").bind(id).run();
    await db.prepare("DELETE FROM sent_emails WHERE id = ? AND user_id = ?").bind(id, user.userId).run();
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[API:sent:DELETE]", error);
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}
