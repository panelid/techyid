import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/email/open/[token] — 1x1 tracking pixel
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const db = getDB();

  // Transparent 1x1 GIF
  const pixel = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
  );

  if (db) {
    try {
      const rec: any = await db
        .prepare(
          "SELECT t.sent_email_id, " +
          "CAST((julianday('now') - julianday(s.created_at))*86400 AS INTEGER) AS gap_sec " +
          "FROM email_tracking t JOIN sent_emails s ON s.id = t.sent_email_id " +
          "WHERE t.token = ? LIMIT 1"
        )
        .bind(token)
        .first();
      if (rec) {
        // Forensics: store headers of the FIRST hit + count all hits
        const ua = request.headers.get("user-agent") || "";
        const purpose = request.headers.get("purpose") || "";
        const secFetch = request.headers.get("sec-fetch-mode") || "";
        const fwd = request.headers.get("x-forwarded-for") || "";
        // cf-connecting-ip is set by Cloudflare edge and cannot be spoofed by clients
        const cip = request.headers.get("cf-connecting-ip") || "";
        const snapshot = JSON.stringify({ ua, purpose, secFetch, fwd, cip });
        await db
          .prepare(
            "UPDATE email_tracking SET hit_count = hit_count + 1, " +
            "last_hit_at = datetime('now'), " +
            "first_hit_headers = COALESCE(first_hit_headers, ?) WHERE token = ?"
          )
          .bind(snapshot, token)
          .run();
        // Apple Mail Privacy Protection prefetch: header Purpose: preview
        // or UA AppleMailProxy — NOT a real open, skip status update.
        const isPrefetch =
          purpose.toLowerCase().includes("preview") ||
          ua.toLowerCase().includes("applemailproxy");
        // Gmail image proxy (rate-limited-proxy-*.google.com, ASN15169):
        // auto-fetches pixels 1-3s after delivery = machine scan, not a human open.
        // Proven 2026-08-31 via CF edge logs: hits from 66.249.89.x, UA "Edge/12.246".
        // A hit from these IPs AFTER the scan window = human clicked "display images".
        const isGoogleProxy =
          cip.startsWith("66.249.") || // Google crawler/proxy IPv4 66.249.64.0/18
          cip.startsWith("2404:6800:") || // Google IPv6
          cip.startsWith("2607:f350:"); // Google IPv6 (NA)
        const SCAN_WINDOW_SEC = 120;
        const isScan = isGoogleProxy && (rec.gap_sec ?? 999999) <= SCAN_WINDOW_SEC;
        if (!isPrefetch && !isScan) {
          await db
            .prepare(
              "UPDATE sent_emails SET status = 'opened', opened_at = datetime('now') " +
              "WHERE id = ? AND status NOT IN ('opened','clicked')"
            )
            .bind(rec.sent_email_id)
            .run();
        }
      }
    } catch (e) {
      console.error("open tracking failed", e);
    }
  }

  return new NextResponse(pixel, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      "Content-Length": String(pixel.length),
    },
  });
}
