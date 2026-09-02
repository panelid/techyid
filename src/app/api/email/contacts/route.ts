import { NextResponse } from "next/server";
import { getDBReady } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// Contact history for the compose tab: unique recipient addresses the user
// has ever sent to, with count + last-sent date. Addresses removed via
// DELETE are stored in email_contacts_hidden and filtered out here.

function splitAddrs(toAddr: string): string[] {
  return String(toAddr || "")
    .split(/[,;]\s*/)
    .map((a) => a.trim().toLowerCase())
    .filter((a) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a));
}

export async function GET(request: Request) {
  try {
    const db = await getDBReady();
    if (!db) return NextResponse.json({ contacts: [] });

    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [sent, hidden] = await Promise.all([
      db
        .prepare(
          "SELECT to_addr, created_at FROM sent_emails WHERE user_id = ? ORDER BY created_at DESC LIMIT 1000",
        )
        .bind(user.userId)
        .all(),
      db
        .prepare("SELECT address FROM email_contacts_hidden WHERE user_id = ?")
        .bind(user.userId)
        .all()
        .catch(() => ({ results: [] as any[] })), // table may not exist until /api/migrate ran
    ]);

    const hiddenSet = new Set((hidden.results || []).map((r: any) => r.address));
    const map = new Map<string, { address: string; count: number; last_sent: string }>();
    for (const row of sent.results || []) {
      for (const addr of splitAddrs(row.to_addr)) {
        if (hiddenSet.has(addr)) continue;
        const ex = map.get(addr);
        if (ex) ex.count += 1;
        else map.set(addr, { address: addr, count: 1, last_sent: row.created_at });
      }
    }

    const contacts = Array.from(map.values()).sort((a, b) =>
      String(b.last_sent).localeCompare(String(a.last_sent)),
    );
    return NextResponse.json({ contacts });
  } catch (e: any) {
    console.error("contacts GET failed", e);
    return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const db = await getDBReady();
    if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 500 });

    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { address } = await request.json();
    const addr = String(address || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      return NextResponse.json({ error: "Alamat tidak valid" }, { status: 400 });
    }

    await db
      .prepare(
        "INSERT OR IGNORE INTO email_contacts_hidden (user_id, address) VALUES (?, ?)",
      )
      .bind(user.userId, addr)
      .run();

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("contacts DELETE failed", e);
    return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 });
  }
}
