import { NextResponse } from "next/server";
import { getDBReady } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const db = await getDBReady();
    if (!db) return NextResponse.json({ emails: [] });

    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { results } = await db
      .prepare(
        "SELECT s.id, s.from_addr, s.to_addr, s.subject, s.status, s.created_at, s.opened_at, s.clicked_at, " +
        "(SELECT hit_count FROM email_tracking t WHERE t.sent_email_id = s.id) AS hit_count, " +
        "(SELECT last_hit_at FROM email_tracking t WHERE t.sent_email_id = s.id) AS last_hit_at " +
        "FROM sent_emails s WHERE s.user_id = ? ORDER BY s.created_at DESC LIMIT 100",
      )
      .bind(user.userId)
      .all();

    return NextResponse.json({ emails: results || [] });
  } catch (e: any) {
    console.error("sent list failed", e);
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}
