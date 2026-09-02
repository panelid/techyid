import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { extractEmailBody } from "@/lib/email-body";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDB();
    const user = await getSessionUser(request);
    if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: emailId } = await params;

    const email: any = await db
      .prepare(
        "SELECT id, from_addr, to_addr, subject, body_text, body_r2_key, received_at, is_read FROM emails WHERE id = ? AND user_id = ? LIMIT 1"
      )
      .bind(emailId, user.userId)
      .first();

    if (!email) return NextResponse.json({ error: "Email not found" }, { status: 404 });

    // Parse raw RFC822/MIME jadi teks bersih (multipart + quoted-printable + HTML + reaksi Gmail)
    const body = email.body_text ? extractEmailBody(String(email.body_text)) : "";

    await db
      .prepare("UPDATE emails SET is_read = 1 WHERE id = ? AND user_id = ?")
      .bind(emailId, user.userId)
      .run();

    return NextResponse.json({
      email: {
        id: email.id,
        from: email.from_addr,
        to: email.to_addr,
        subject: email.subject,
        receivedAt: email.received_at,
        isRead: true,
        body,
      },
    });
  } catch (error: any) {
    console.error("[API:inbox:GET]", error);
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
      .prepare("SELECT id FROM emails WHERE id = ? AND user_id = ? LIMIT 1")
      .bind(id, user.userId)
      .first();
    if (!email) return NextResponse.json({ error: "Email not found" }, { status: 404 });

    await db.prepare("DELETE FROM emails WHERE id = ? AND user_id = ?").bind(id, user.userId).run();
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[API:inbox:DELETE]", error);
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}
