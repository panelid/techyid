import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET() {
  try {
    const db = getDB();
    if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

    const results: string[] = [];

    // Add domain_type column
    try {
      await db.prepare("ALTER TABLE custom_domains ADD COLUMN domain_type TEXT NOT NULL DEFAULT 'full'").run();
      results.push("domain_type added");
    } catch (e: any) {
      results.push(`domain_type: ${e?.message || "exists"}`);
    }

    // Add parent_domain column
    try {
      await db.prepare("ALTER TABLE custom_domains ADD COLUMN parent_domain TEXT").run();
      results.push("parent_domain added");
    } catch (e: any) {
      results.push(`parent_domain: ${e?.message || "exists"}`);
    }

    // Add resend_domain_id column (may already exist)
    try {
      await db.prepare("ALTER TABLE custom_domains ADD COLUMN resend_domain_id TEXT").run();
      results.push("resend_domain_id added");
    } catch (e: any) {
      results.push(`resend_domain_id: ${e?.message || "exists"}`);
    }

    // Ensure sent_emails has resend_id + body (open-tracking needs resend_id)
    try {
      await db.prepare("ALTER TABLE sent_emails ADD COLUMN resend_id TEXT").run();
      results.push("sent_emails.resend_id added");
    } catch (e: any) {
      results.push(`sent_emails.resend_id: ${e?.message || "exists"}`);
    }
    try {
      await db.prepare(`ALTER TABLE sent_emails ADD COLUMN body TEXT`).run();
      results.push("sent_emails.body added");
    } catch (e: any) {
      results.push(`sent_emails.body: ${e?.message || "exists"}`);
    }

    // Forensics: capture headers of first pixel hit (proxy vs real client)
    try {
      await db.prepare(`ALTER TABLE email_tracking ADD COLUMN first_hit_headers TEXT`).run();
      results.push("email_tracking.first_hit_headers added");
    } catch (e: any) {
      results.push(`email_tracking.first_hit_headers: ${e?.message || "exists"}`);
    }
    try {
      await db.prepare(`ALTER TABLE email_tracking ADD COLUMN hit_count INTEGER NOT NULL DEFAULT 0`).run();
      results.push("email_tracking.hit_count added");
    } catch (e: any) {
      results.push(`email_tracking.hit_count: ${e?.message || "exists"}`);
    }

    // Click tracking: links rewritten to /api/email/click/{token}
    try {
      await db.prepare(`ALTER TABLE email_tracking ADD COLUMN click_count INTEGER NOT NULL DEFAULT 0`).run();
      results.push("email_tracking.click_count added");
    } catch (e: any) {
      results.push(`email_tracking.click_count: ${e?.message || "exists"}`);
    }
    try {
      await db.prepare(`ALTER TABLE sent_emails ADD COLUMN clicked_at TEXT`).run();
      results.push("sent_emails.clicked_at added");
    } catch (e: any) {
      results.push(`sent_emails.clicked_at: ${e?.message || "exists"}`);
    }

    // Re-open signal: last time the pixel was fetched (human reload or proxy refresh)
    try {
      await db.prepare(`ALTER TABLE email_tracking ADD COLUMN last_hit_at TEXT`).run();
      results.push("email_tracking.last_hit_at added");
    } catch (e: any) {
      results.push(`email_tracking.last_hit_at: ${e?.message || "exists"}`);
    }

    // Contact history: addresses the user removed from compose suggestions
    try {
      await db.prepare(`CREATE TABLE IF NOT EXISTS email_contacts_hidden (
        user_id TEXT NOT NULL,
        address TEXT NOT NULL,
        hidden_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, address)
      )`).run();
      results.push("email_contacts_hidden ready");
    } catch (e: any) {
      results.push(`email_contacts_hidden: ${e?.message || "exists"}`);
    }

    // Spam detection on inbound emails
    try {
      await db.prepare(`ALTER TABLE emails ADD COLUMN spam_score INTEGER NOT NULL DEFAULT 0`).run();
      results.push("emails.spam_score added");
    } catch (e: any) {
      results.push(`emails.spam_score: ${e?.message || "exists"}`);
    }
    try {
      await db.prepare(`ALTER TABLE emails ADD COLUMN spam_reasons TEXT`).run();
      results.push("emails.spam_reasons added");
    } catch (e: any) {
      results.push(`emails.spam_reasons: ${e?.message || "exists"}`);
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
