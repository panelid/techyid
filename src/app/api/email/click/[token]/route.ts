import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/email/click/[token]?u=<encoded destination>
// Records a click (genuine human action — mail clients do not prefetch links)
// then redirects to the original destination.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const url = new URL(request.url);
  const dest = url.searchParams.get("u") || "";

  // Only allow http(s) redirects — block javascript:/data:/etc (open redirect)
  let safeDest = "";
  try {
    const parsed = new URL(dest);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      safeDest = parsed.href;
    }
  } catch {}

  const db = getDB();
  if (db) {
    try {
      const rec: any = await db
        .prepare("SELECT sent_email_id FROM email_tracking WHERE token = ? LIMIT 1")
        .bind(token)
        .first();
      if (rec) {
        await db
          .prepare(
            "UPDATE email_tracking SET click_count = click_count + 1 WHERE token = ?"
          )
          .bind(token)
          .run();
        await db
          .prepare(
            "UPDATE sent_emails SET status = 'clicked', clicked_at = datetime('now'), " +
            "opened_at = COALESCE(opened_at, datetime('now')) " +
            "WHERE id = ? AND status != 'clicked'"
          )
          .bind(rec.sent_email_id)
          .run();
      }
    } catch (e) {
      console.error("click tracking failed", e);
    }
  }

  if (safeDest) {
    return NextResponse.redirect(safeDest, 302);
  }
  return new NextResponse("Link tidak valid", { status: 400 });
}
