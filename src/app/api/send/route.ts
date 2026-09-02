import { NextResponse } from "next/server";
import { getDBReady } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function POST(request: Request) {
  try {
    const db = await getDBReady();
    const user = await getSessionUser(request);
    const { env } = getCloudflareContext();
    const resendKey = (env as any).RESEND_API_KEY;

    if (!db) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!resendKey) {
      return NextResponse.json({ error: "Email service unavailable" }, { status: 500 });
    }

    const body = await request.json();
    const { to, subject, html, fromAddress: requestedFrom } = body;

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: "to, subject, html are required" },
        { status: 400 }
      );
    }

    // Resolve from address: alias picker → default alias → noreply@techy.id
    let fromAddress = "noreply@techy.id";
    try {
      if (requestedFrom) {
        const [lp, dom] = String(requestedFrom).toLowerCase().split("@");
        if (lp && dom) {
          const alias: any = await db
            .prepare("SELECT local_part, domain FROM email_aliases WHERE user_id = ? AND local_part = ? AND domain = ? LIMIT 1")
            .bind(user.userId, lp, dom)
            .first();
          if (alias) {
            fromAddress = `${alias.local_part}@${alias.domain}`;
          }
        }
      } else {
        const defaultAlias: any = await db
          .prepare("SELECT local_part, domain FROM email_aliases WHERE user_id = ? AND is_default = 1 LIMIT 1")
          .bind(user.userId)
          .first();
        if (defaultAlias) {
          fromAddress = `${defaultAlias.local_part}@${defaultAlias.domain}`;
        } else {
          const activeDomain: any = await db
            .prepare("SELECT domain FROM custom_domains WHERE user_id = ? AND is_verified = 1 AND resend_status = 'verified' ORDER BY created_at DESC LIMIT 1")
            .bind(user.userId)
            .first();
          if (activeDomain) {
            fromAddress = `noreply@${activeDomain.domain}`;
          }
        }
      }
    } catch (domainError: any) {
      console.warn("[API:send:POST] Failed to resolve from address:", domainError?.message);
    }

    // Open-tracking: inject 1x1 pixel into email body
    const trackingToken = crypto.randomUUID().replace(/-/g, "");
    let htmlBody = html;
    try {
      const pixel = `<img src="${new URL(`/api/email/open/${trackingToken}`, request.url).href}" width="1" height="1" alt="" style="display:none" />`;
      if (/<html|<body/i.test(htmlBody)) {
        htmlBody = htmlBody.replace(/<\/body>/i, `${pixel}</body>`);
        if (!/<\/body>/i.test(htmlBody)) htmlBody += pixel;
      } else {
        htmlBody = `${htmlBody}<br/>${pixel}`;
      }
    } catch {}

    // Click-tracking: rewrite http(s) links to /api/email/click/{token}?u={dest}
    // Gmail proxy prefetches IMAGES but never links, so a click hit is a
    // genuine human action (verified empirically 2026-08-29).
    try {
      const clickBase = new URL(`/api/email/click/${trackingToken}`, request.url).href;
      htmlBody = htmlBody.replace(
        /(<a\s[^>]*?href=")(https?:\/\/[^"]+)("[^>]*>)/gi,
        (_m: string, pre: string, dest: string, post: string) => `${pre}${clickBase}?u=${encodeURIComponent(dest)}${post}`
      );
    } catch {}

    // Send via Resend API
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to,
        subject,
        html: htmlBody,
        open_tracking: true,
      }),
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      console.error("[API:send:POST] Resend error:", resendError);
      let detail = "Gagal mengirim email";
      try { detail = JSON.parse(resendError).message || detail; } catch {}
      return NextResponse.json({ error: `Gagal mengirim email: ${detail}` }, { status: 500 });
    }

    const resendData = await resendResponse.json();

    // Log outbound email + tracking pixel
    let sentId = crypto.randomUUID();
    try {
      await db.prepare(
        "INSERT INTO sent_emails (id, user_id, from_addr, to_addr, subject, status, resend_id, body, created_at) VALUES (?, ?, ?, ?, ?, 'sent', ?, ?, datetime('now'))"
      ).bind(sentId, user.userId, fromAddress, to, subject, resendData.id, html).run();
      await db.prepare(
        "INSERT INTO email_tracking (id, sent_email_id, token) VALUES (?, ?, ?)"
      ).bind(crypto.randomUUID(), sentId, trackingToken).run();
    } catch (logErr: any) {
      console.error("[API:send:POST] failed to log sent email:", logErr?.message);
    }

    return NextResponse.json(
      {
        success: true,
        messageId: resendData.id,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[API:send:POST]", error);
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}
