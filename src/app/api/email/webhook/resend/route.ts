import { NextResponse } from "next/server";
import { getDBReady } from "@/lib/db";
import { createHmac, timingSafeEqual } from "crypto";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

// POST /api/email/webhook/resend
// Resend webhook: handles email.opened / email.bounced via SIGNED payload (svix scheme).
// Signature = base64(HMAC-SHA256(key, "<svix-id>.<svix-timestamp>.<rawBody>")).
// Key = signing_secret with "whsec_" prefix, base64-decoded.
export async function POST(request: Request) {
  const db = await getDBReady();
  if (!db) return NextResponse.json({ error: "db unavailable" }, { status: 500 });

  // Read secret from CF env binding (fallback process.env for local dev).
  let secret: string | undefined;
  try {
    const { env } = getCloudflareContext() as any;
    secret = env?.RESEND_WEBHOOK_SECRET;
  } catch {
    /* not on CF (local) */
  }
  if (!secret) secret = (process.env as any).RESEND_WEBHOOK_SECRET;

  const rawBody = await request.text();

  // FAIL CLOSED: without a configured secret we do not trust any payload.
  if (!secret) {
    console.error("[webhook:resend] RESEND_WEBHOOK_SECRET not configured — rejecting");
    return NextResponse.json({ error: "webhook secret not configured" }, { status: 503 });
  }

  const svixId = request.headers.get("svix-id") || "";
  const svixTs = request.headers.get("svix-timestamp") || "";
  const svixSig = request.headers.get("svix-signature") || "";

  const verify = (): boolean => {
    if (!svixId || !svixTs || !svixSig) return false;
    // Reject stamps older than 5 min (replay protection)
    const ts = Number(svixTs);
    if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
    let keyBytes: Buffer;
    try {
      keyBytes = Buffer.from(secret!.replace(/^whsec_/, ""), "base64");
    } catch {
      return false;
    }
    const signedContent = `${svixId}.${svixTs}.${rawBody}`;
    const expected = createHmac("sha256", keyBytes).update(signedContent).digest("base64");
    // svix-signature may carry multiple space-separated "v1,<b64>" entries
    return svixSig.split(" ").some((part) => {
      const b64 = part.split(",")[1];
      if (!b64) return false;
      const a = Buffer.from(expected);
      const b = Buffer.from(b64);
      return a.length === b.length && timingSafeEqual(a, b);
    });
  };

  if (!verify()) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const event = payload.type || payload.event;
  const data: any = payload.data || {};
  const resendId: string | undefined = data.id;

  if (!resendId) return NextResponse.json({ ok: true, ignored: "no id" });

  try {
    if (event === "email.opened") {
      await db
        .prepare("UPDATE sent_emails SET status = 'opened', opened_at = datetime('now') WHERE resend_id = ? AND status NOT IN ('opened','clicked')")
        .bind(resendId)
        .run();
    } else if (event === "email.bounced" || event === "email.delivery_delayed" || event === "email.complained") {
      const st = event === "email.bounced" ? "bounced" : "delayed";
      await db
        .prepare("UPDATE sent_emails SET status = ? WHERE resend_id = ?")
        .bind(st, resendId)
        .run();
    }
  } catch (e: any) {
    console.error("[webhook:resend] update failed", e?.message);
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, event, verified: true });
}
