// src/email-handler.ts
// Inbound email handler for Cloudflare Email Routing

import { getDB } from "@/lib/db";

export interface EmailMessage {
  from: string;
  to: string;
  subject?: string;
  raw: string;
}

// Heuristic spam scoring from raw MIME headers. Cloudflare Email Routing
// hands us the message AFTER its own spam filtering, so anything reaching
// here already passed the gate; these signals flag "suspicious but delivered"
// so the UI can show a SPAM badge instead of silently trusting the sender.
export function scoreSpam(raw: string): { score: number; reasons: string[] } {
  const headers = (raw.split("\r\n\r\n")[0] || raw.slice(0, 20000)).toLowerCase();
  const get = (name: string): string => {
    const m = headers.match(new RegExp("^" + name + ":\\s*(.*)$", "m"));
    return m ? m[1].trim() : "";
  };
  let score = 0;
  const reasons: string[] = [];

  // Cloudflare's own verdict header (when present)
  const cfSpam = get("cf-spam-verdict") || get("x-cf-spam-verdict");
  if (cfSpam) {
    if (/spam|high|suspect/.test(cfSpam)) { score += 3; reasons.push("CF verdict: " + cfSpam.slice(0, 40)); }
  }

  // SpamAssassin-style score (added by some upstream filters)
  const sa = get("x-spam-status");
  const saScore = sa.match(/score=([0-9.]+)/);
  if (saScore && parseFloat(saScore[1]) >= 5) { score += 3; reasons.push("spam score " + saScore[1]); }

  // Authentication failures — the strongest practical signal
  const arc = get("authentication-results") + " " + get("received-spf") + " " + get("received-dkim");
  if (/spf=fail|dkim=fail|dmarc=fail/.test(arc)) { score += 2; reasons.push("SPF/DKIM/DMARC gagal"); }
  else if (/spf=softfail|dmarc=permerror/.test(arc)) { score += 1; reasons.push("SPF softfail"); }

  // Bulk/sent headers
  if (/^precedence:\s*bulk/m.test(headers) || get("auto-submitted")) { score += 1; reasons.push("pesan otomatis/bulk"); }

  // Deceptive From: display name vs real address (classic phishing)
  const fromH = headers.match(/^from:\s*(.*)$/m);
  if (fromH) {
    const disp = fromH[1].match(/"([^"]+)"\s*<([^>]+)>/);
    if (disp) {
      const dName = disp[1].toLowerCase().replace(/[^a-z0-9]/g, "");
      const dAddr = disp[2].split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      if (dName.length > 3 && dAddr.length > 3 && !dName.includes(dAddr) && !dAddr.includes(dName)) {
        score += 2; reasons.push("nama pengirim palsu");
      }
    }
  }

  // Links to URL shorteners / known-abused domains in body preview
  const body = raw.slice(0, 60000);
  if (/t\.co|bit\.ly|tinyurl|cutt\.ly|is\.gd|rb\.gy/i.test(body)) { score += 1; reasons.push("link pendek"); }
  if (/\.zip\.exe|\.apk["'\s]|winmail\.dat/i.test(body)) { score += 2; reasons.push("lampuan mencurigakan"); }

  return { score, reasons };
}

export async function handleInboundEmail(message: EmailMessage, env: any) {
  try {
    const db = await getDB();
    if (!db) {
      console.error("[EMAIL] DB unavailable");
      return;
    }

    const { from, to, subject, raw } = message;
    const toLocal = to.split("@")[0];
    const toDomain = to.split("@")[1];

    if (!toDomain) {
      console.error("[EMAIL] Invalid to address:", to);
      return;
    }

    // Find custom domain in DB
    const domainRecord: any = await db
      .prepare("SELECT user_id, id FROM custom_domains WHERE domain = ? LIMIT 1")
      .bind(toDomain)
      .first();

    if (!domainRecord) {
      console.warn("[EMAIL] Domain not found:", toDomain);
      return; // Drop email, domain not configured
    }

    const userId = domainRecord.user_id;
    const domainId = domainRecord.id;
    const emailId = crypto.randomUUID();
    const receivedAt = Math.floor(Date.now() / 1000);

    // Get R2 bucket
    const r2 = (env as any).R2;
    if (!r2) {
      console.error("[EMAIL] R2 bucket unavailable");
      return;
    }

    // Store raw body in R2
    const r2Key = `emails/${userId}/${emailId}`;
    try {
      await r2.put(r2Key, raw, {
        httpMetadata: {
          contentType: "message/rfc822",
        },
      });
    } catch (r2Error: any) {
      console.error("[EMAIL] R2 put failed:", r2Error?.message);
      return;
    }

    // Store metadata in D1 (+ spam heuristics)
    const spam = scoreSpam(raw);
    try {
      await db
        .prepare(
          "INSERT INTO emails (id, user_id, domain_id, from_addr, to_addr, subject, body_r2_key, received_at, spam_score, spam_reasons) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(emailId, userId, domainId, from, to, subject || "", r2Key, receivedAt, spam.score, spam.reasons.join("; ") || null)
        .run();
    } catch (dbError: any) {
      console.error("[EMAIL] DB insert failed:", dbError?.message);
      return;
    }

    // Get user email for forwarding
    const userRecord: any = await db
      .prepare("SELECT email FROM users WHERE id = ? LIMIT 1")
      .bind(userId)
      .first();

    if (!userRecord || !userRecord.email) {
      console.warn("[EMAIL] User email not found for forwarding:", userId);
      return;
    }

    // Forward to user email
    try {
      await message.forward(userRecord.email);
      console.log(
        "[EMAIL] Forwarded email from",
        from,
        "to",
        userRecord.email,
        "ID:",
        emailId
      );
    } catch (forwardError: any) {
      console.error("[EMAIL] Forward failed:", forwardError?.message);
    }
  } catch (error: any) {
    console.error("[EMAIL] Handler error:", error?.message);
  }
}
