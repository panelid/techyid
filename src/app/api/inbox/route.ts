import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const db = await getDB();
    const user = await getSessionUser(request);

    if (!db) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const limit = 50;

    const { results } = await db
      .prepare(
        "SELECT id, from_addr, to_addr, subject, received_at, is_read, spam_score, spam_reasons FROM emails WHERE user_id = ? ORDER BY received_at DESC LIMIT ?"
      )
      .bind(user.userId, limit)
      .all();

    return NextResponse.json({
      emails: (results || []).map((e: any) => ({
        id: e.id,
        from: e.from_addr,
        to: e.to_addr,
        subject: e.subject,
        receivedAt: e.received_at,
        isRead: Boolean(e.is_read),
        spamScore: e.spam_score || 0,
        spamReasons: e.spam_reasons || "",
      })),
    });
  } catch (error: any) {
    console.error("[API:inbox:GET]", error);
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}
