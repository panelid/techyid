"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Shield, Users, Link2, Globe, Mail, Send, Inbox, MousePointerClick, ArrowLeft,
  Ban, Trash2, RefreshCw, Search, Megaphone, Activity, ScrollText,
} from "lucide-react";

// ---------- types ----------
interface Stats {
  totalUsers: number; adminUsers: number; totalLinks: number; totalClicks: number;
  totalDomains: number; verifiedDomains: number; totalInbound: number; unreadInbound: number;
  totalOutbound: number; sentOutbound: number; openedOutbound: number; totalAliases: number;
}
interface TopLink { slug: string; type: string; click_count: number; }
interface RecentUser { id: string; email: string; username: string | null; created_at: string; }
interface RecentSent { id: string; from_addr: string; to_addr: string; subject: string | null; status: string; created_at: string; }
interface AdminUserRow { id: string; email: string; username: string | null; created_at: string; link_count: number; domain_count: number; is_banned: number; }
interface AdminLinkRow { id: string; slug: string; type: string; click_count: number; created_at: string; owner_email: string | null; user_id: string | null; }
interface AdminDomainRow { id: string; user_id: string; domain: string; is_verified: number; zone_status: string; worker_status: string; email_status: string; resend_status: string; domain_type: string; owner_email: string | null; }
interface EmailRow { id: string; from_addr: string; to_addr: string; subject: string | null; received_at?: number; created_at?: string; is_read?: number; status?: string; }
interface AuditRow { id: string; admin_email: string | null; action: string; target_type: string | null; target_id: string | null; detail: string | null; created_at: string; }

const C = {
  border: "3px solid #000", radius: 12, shadow: "4px 4px 0 #000", card: "#fff", bg: "#f5f5f0",
};

export default function AdminClient({ email, username }: { email: string; username?: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "users" | "links" | "domains" | "email" | "health" | "audit" | "broadcast">("overview");

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "16px 16px 90px", fontFamily: "'Space Grotesk', sans-serif", background: C.bg, minHeight: "100vh" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <button onClick={() => router.push("/dashboard")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22 }}><ArrowLeft size={22} /></button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}><Shield size={20} /> Admin Panel</h1>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#666" }}>{email}{username ? ` (${username})` : ""}</p>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        {([
          ["overview", "Overview", <Activity size={14} />],
          ["users", "Users", <Users size={14} />],
          ["links", "Links", <Link2 size={14} />],
          ["domains", "Domains", <Globe size={14} />],
          ["email", "Email", <Mail size={14} />],
          ["health", "Health", <Activity size={14} />],
          ["audit", "Audit", <ScrollText size={14} />],
          ["broadcast", "Broadcast", <Megaphone size={14} />],
        ] as [any, string, React.ReactNode][]).map(([k, label, icon]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            border: C.border, borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 700,
            cursor: "pointer", background: tab === k ? "#d4ff00" : "#fff", display: "flex", alignItems: "center", gap: 4,
          }}>{icon} {label}</button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "users" && <UsersTab />}
      {tab === "links" && <LinksTab />}
      {tab === "domains" && <DomainsTab />}
      {tab === "email" && <EmailTab />}
      {tab === "health" && <HealthTab />}
      {tab === "audit" && <AuditTab />}
      {tab === "broadcast" && <BroadcastTab />}
    </div>
  );
}

// ============ OVERVIEW ============
function OverviewTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [topLinks, setTopLinks] = useState<TopLink[]>([]);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [recentSent, setRecentSent] = useState<RecentSent[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats").then(r => r.json()).then(d => {
      if (d.stats) { setStats(d.stats); setTopLinks(d.topLinks || []); setRecentUsers(d.recentUsers || []); setRecentSent(d.recentSent || []); }
      else setErr("Gagal memuat");
    }).catch(e => setErr(e.message));
  }, []);

  if (err) return <p style={{ color: "#c00", background: "#fee", padding: 10, borderRadius: 8 }}>{err}</p>;
  if (!stats) return <p style={{ color: "#888" }}>Memuat...</p>;

  const cards = [
    ["Total User", stats.totalUsers, "#d4ff00"], ["Admin", stats.adminUsers, "#000"],
    ["Total Link", stats.totalLinks, "#0066ff"], ["Total Klik", stats.totalClicks, "#ff6600"],
    ["Domain", `${stats.verifiedDomains}/${stats.totalDomains}`, "#00aa00"], ["Email Masuk", stats.totalInbound, "#9900ff"],
    ["Belum Dibaca", stats.unreadInbound, "#cc0000"], ["Email Keluar", stats.totalOutbound, "#0099cc"],
  ] as [string, number | string, string][];

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
        {cards.map(([l, v, c]) => (
          <div key={l} style={{ border: C.border, borderRadius: C.radius, padding: 12, background: "#fff" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#444" }}>{l}</div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>{v}</div>
          </div>
        ))}
      </div>
      <Section title="Link Terpopuler" items={topLinks.map(l => [l.slug, `${l.click_count} klik`])} />
      <Section title="User Terbaru" items={recentUsers.map(u => [u.email, (u.created_at || "").slice(0, 10)])} />
      <Section title="Email Keluar Terbaru" items={recentSent.map(s => [`${s.to_addr} — ${s.subject || "(no subj)"}`, s.status])} />
    </>
  );
}

function Section({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <>
      <h2 style={{ fontSize: 15, marginTop: 22, marginBottom: 8 }}>{title}</h2>
      <div style={{ border: C.border, borderRadius: C.radius, overflow: "hidden", background: "#fff" }}>
        {items.length === 0 && <p style={{ padding: 12, margin: 0, color: "#888" }}>Belum ada data.</p>}
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderTop: i === 0 ? "none" : "1px solid #eee", fontSize: 14 }}>
            <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it[0]}</span>
            <span style={{ color: "#ff6600", fontWeight: 700, marginLeft: 8 }}>{it[1]}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ============ USERS ============
function UsersTab() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/users?q=${encodeURIComponent(q)}&page=${page}`).then(r => r.json()).then(d => {
      setUsers(d.users || []); setTotal(d.total || 0);
    }).catch(() => setMsg("Gagal memuat")).finally(() => setLoading(false));
  }, [q, page]);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: string, reason?: string) => {
    setMsg(null);
    const r = await fetch(`/api/admin/users/${id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setMsg(`✓ ${action} ok`); load(); }
    else setMsg(`✗ ${d.error || "gagal"}`);
  };
  const del = async (id: string) => {
    if (!confirm("Hapus user ini beserta semua data?")) return;
    setMsg(null);
    const r = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setMsg("✓ user dihapus"); load(); } else setMsg(`✗ ${d.error || "gagal"}`);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, border: C.border, borderRadius: 8, padding: "6px 10px", background: "#fff" }}>
          <Search size={14} /><input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Cari email / username / id" style={{ border: "none", outline: "none", flex: 1, fontFamily: "inherit" }} />
        </div>
      </div>
      {msg && <p style={{ color: msg.startsWith("✓") ? "#080" : "#c00", fontWeight: 700 }}>{msg}</p>}
      {loading && <p style={{ color: "#888" }}>Memuat...</p>}
      <div style={{ border: C.border, borderRadius: C.radius, overflow: "hidden", background: "#fff" }}>
        {users.map((u, i) => (
          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderTop: i === 0 ? "none" : "1px solid #eee", fontSize: 13 }}>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ fontWeight: 700 }}>{u.email} {u.username ? <span style={{ color: "#888" }}>({u.username})</span> : null} {u.is_banned ? <span style={{ color: "#c00", fontWeight: 800 }}>[BANNED]</span> : null}</div>
              <div style={{ fontSize: 11, color: "#888" }}>{u.link_count} link · {u.domain_count} domain · {u.created_at?.slice(0, 10)}</div>
            </div>
            <button onClick={() => act(u.id, u.is_banned ? "unban" : "ban", u.is_banned ? undefined : "Admin action")} style={btnStyle(u.is_banned ? "#0099cc" : "#cc0000")}>{u.is_banned ? "Unban" : <><Ban size={12} /> Ban</>}</button>
            <button onClick={() => del(u.id)} style={btnStyle("#999")}><Trash2 size={12} /></button>
          </div>
        ))}
        {users.length === 0 && !loading && <p style={{ padding: 12, margin: 0, color: "#888" }}>Tidak ada user.</p>}
      </div>
      <Pager page={page} total={total} limit={20} setPage={setPage} />
    </div>
  );
}

// ============ LINKS ============
function LinksTab() {
  const [links, setLinks] = useState<AdminLinkRow[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/links?q=${encodeURIComponent(q)}&page=${page}`).then(r => r.json()).then(d => {
      setLinks(d.links || []); setTotal(d.total || 0);
    }).catch(() => setMsg("Gagal memuat")).finally(() => setLoading(false));
  }, [q, page]);
  useEffect(() => { load(); }, [load]);

  const del = async (id: string) => {
    if (!confirm("Hapus link ini?")) return;
    setMsg(null);
    const r = await fetch(`/api/admin/links/${id}`, { method: "DELETE" });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setMsg("✓ link dihapus"); load(); } else setMsg(`✗ ${d.error || "gagal"}`);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, border: C.border, borderRadius: 8, padding: "6px 10px", background: "#fff" }}>
          <Search size={14} /><input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Cari slug / data / owner" style={{ border: "none", outline: "none", flex: 1, fontFamily: "inherit" }} />
        </div>
      </div>
      {msg && <p style={{ color: msg.startsWith("✓") ? "#080" : "#c00", fontWeight: 700 }}>{msg}</p>}
      {loading && <p style={{ color: "#888" }}>Memuat...</p>}
      <div style={{ border: C.border, borderRadius: C.radius, overflow: "hidden", background: "#fff" }}>
        {links.map((l, i) => (
          <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderTop: i === 0 ? "none" : "1px solid #eee", fontSize: 13 }}>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ fontWeight: 700 }}>/{l.slug} <span style={{ color: "#888", fontWeight: 400, fontSize: 11 }}>{l.type}</span></div>
              <div style={{ fontSize: 11, color: "#888" }}>{l.owner_email || "(no owner)"} · {l.click_count} klik</div>
            </div>
            <button onClick={() => del(l.id)} style={btnStyle("#999")}><Trash2 size={12} /></button>
          </div>
        ))}
        {links.length === 0 && !loading && <p style={{ padding: 12, margin: 0, color: "#888" }}>Tidak ada link.</p>}
      </div>
      <Pager page={page} total={total} limit={30} setPage={setPage} />
    </div>
  );
}

// ============ DOMAINS ============
function DomainsTab() {
  const [domains, setDomains] = useState<AdminDomainRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/domains?q=${encodeURIComponent(q)}`).then(r => r.json()).then(d => setDomains(d.domains || [])).catch(() => setMsg("Gagal")).finally(() => setLoading(false));
  }, [q]);
  useEffect(() => { load(); }, [load]);

  const del = async (id: string) => {
    if (!confirm("Hapus domain ini dari sistem (zone CF tidak dihapus)?")) return;
    setMsg(null);
    const r = await fetch(`/api/admin/domains/${id}`, { method: "DELETE" });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setMsg("✓ domain dihapus"); load(); } else setMsg(`✗ ${d.error || "gagal"}`);
  };
  const sync = async (id: string) => {
    setMsg("Syncing...");
    const r = await fetch(`/api/admin/domains/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    const d = await r.json().catch(() => ({}));
    setMsg(r.ok ? `✓ sync: ${JSON.stringify(d).slice(0, 80)}` : `✗ ${d.error || "gagal"}`);
    load();
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, border: C.border, borderRadius: 8, padding: "6px 10px", background: "#fff" }}>
          <Search size={14} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari domain / owner" style={{ border: "none", outline: "none", flex: 1, fontFamily: "inherit" }} />
        </div>
      </div>
      {msg && <p style={{ color: msg.startsWith("✓") ? "#080" : "#c00", fontWeight: 700 }}>{msg}</p>}
      {loading && <p style={{ color: "#888" }}>Memuat...</p>}
      <div style={{ border: C.border, borderRadius: C.radius, overflow: "hidden", background: "#fff" }}>
        {domains.map((d, i) => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderTop: i === 0 ? "none" : "1px solid #eee", fontSize: 13 }}>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ fontWeight: 700 }}>{d.domain} {d.domain_type === "email_only" ? <span style={{ fontSize: 10, background: "#eee", padding: "1px 5px", borderRadius: 4 }}>email</span> : null}</div>
              <div style={{ fontSize: 11, color: "#888" }}>{d.owner_email || "(no owner)"} · zone:{d.zone_status} · worker:{d.worker_status} · resend:{d.resend_status}</div>
            </div>
            <button onClick={() => sync(d.id)} style={btnStyle("#0099cc")}><RefreshCw size={12} /></button>
            <button onClick={() => del(d.id)} style={btnStyle("#999")}><Trash2 size={12} /></button>
          </div>
        ))}
        {domains.length === 0 && !loading && <p style={{ padding: 12, margin: 0, color: "#888" }}>Tidak ada domain.</p>}
      </div>
    </div>
  );
}

// ============ EMAIL ============
function EmailTab() {
  const [inbound, setInbound] = useState<EmailRow[]>([]);
  const [outbound, setOutbound] = useState<EmailRow[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/admin/email").then(r => r.json()).then(d => {
      setInbound(d.inbound || []); setOutbound(d.outbound || []); setStats(d.stats || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  if (loading) return <p style={{ color: "#888" }}>Memuat...</p>;
  return (
    <div>
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
          {[["Inbound", stats.totalInbound, "#9900ff"], ["Unread", stats.unreadInbound, "#cc0000"], ["Outbound", stats.totalOutbound, "#0099cc"], ["Opened", stats.openedOutbound, "#00aa00"], ["Sent 24h", stats.sentLast24h, "#0066ff"]].map(([l, v, c]) => (
            <div key={l as string} style={{ border: C.border, borderRadius: C.radius, padding: 10, background: "#fff" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#444" }}>{l}</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{v as number}</div>
            </div>
          ))}
        </div>
      )}
      <h2 style={{ fontSize: 15, margin: "16px 0 8px" }}><Inbox size={14} /> Email Masuk</h2>
      <div style={{ border: C.border, borderRadius: C.radius, overflow: "hidden", background: "#fff" }}>
        {inbound.map((e, i) => (
          <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", borderTop: i === 0 ? "none" : "1px solid #eee", fontSize: 13 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><strong>{e.from_addr}</strong> → {e.to_addr}<br /><span style={{ color: "#888" }}>{e.subject || "(no subj)"}</span></span>
            <span style={{ color: e.is_read ? "#888" : "#c00", fontWeight: 700, marginLeft: 8 }}>{e.is_read ? "read" : "NEW"}</span>
          </div>
        ))}
        {inbound.length === 0 && <p style={{ padding: 12, margin: 0, color: "#888" }}>Kosong.</p>}
      </div>
      <h2 style={{ fontSize: 15, margin: "16px 0 8px" }}><Send size={14} /> Email Keluar</h2>
      <div style={{ border: C.border, borderRadius: C.radius, overflow: "hidden", background: "#fff" }}>
        {outbound.map((e, i) => (
          <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", borderTop: i === 0 ? "none" : "1px solid #eee", fontSize: 13 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><strong>{e.to_addr}</strong><br /><span style={{ color: "#888" }}>{e.subject || "(no subj)"}</span></span>
            <span style={{ color: e.status === "opened" ? "#00aa00" : "#888", fontWeight: 700, marginLeft: 8 }}>{e.status}</span>
          </div>
        ))}
        {outbound.length === 0 && <p style={{ padding: 12, margin: 0, color: "#888" }}>Kosong.</p>}
      </div>
    </div>
  );
}

// ============ HEALTH ============
function HealthTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/admin/health").then(r => r.json()).then(d => setData(d)).catch(() => {}).finally(() => setLoading(false));
  }, []);
  if (loading) return <p style={{ color: "#888" }}>Memuat...</p>;
  if (!data) return <p style={{ color: "#c00" }}>Gagal memuat.</p>;
  const db = data.database || {};
  const kv = data.kv || {};
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
      {Object.entries(db).map(([k, v]) => (
        <div key={k} style={{ border: C.border, borderRadius: C.radius, padding: 12, background: "#fff" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#444", textTransform: "capitalize" }}>{k.replace(/([A-Z])/g, " $1")}</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{v as number}</div>
        </div>
      ))}
      <div style={{ border: C.border, borderRadius: C.radius, padding: 12, background: "#fff" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#444" }}>KV Slug Cache</div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{kv.slugCacheKeys ?? "n/a"}</div>
      </div>
    </div>
  );
}

// ============ AUDIT ============
function AuditTab() {
  const [log, setLog] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/admin/audit").then(r => r.json()).then(d => setLog(d.log || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);
  if (loading) return <p style={{ color: "#888" }}>Memuat...</p>;
  return (
    <div style={{ border: C.border, borderRadius: C.radius, overflow: "hidden", background: "#fff" }}>
      {log.map((a, i) => (
        <div key={a.id} style={{ padding: "8px 10px", borderTop: i === 0 ? "none" : "1px solid #eee", fontSize: 13 }}>
          <div style={{ fontWeight: 700 }}><span style={{ color: "#0099cc" }}>{a.action}</span> {a.target_type || ""} {a.target_id || ""}</div>
          <div style={{ fontSize: 11, color: "#888" }}>{a.admin_email || "?"} · {a.created_at} {a.detail ? `· ${a.detail}` : ""}</div>
        </div>
      ))}
      {log.length === 0 && <p style={{ padding: 12, margin: 0, color: "#888" }}>Belum ada aksi.</p>}
    </div>
  );
}

// ============ BROADCAST ============
function BroadcastTab() {
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [limit, setLimit] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const send = async () => {
    if (!subject || !html) return;
    if (!confirm("Kirim broadcast ke semua user? (Resend free = 100/hari)")) return;
    setSending(true); setResult(null);
    const r = await fetch("/api/admin/broadcast", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, html, limit: limit ? parseInt(limit) : undefined }),
    });
    const d = await r.json().catch(() => ({}));
    setResult(d); setSending(false);
  };
  return (
    <div style={{ border: C.border, borderRadius: C.radius, padding: 16, background: "#fff" }}>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>Kirim email ke semua user terdaftar via noreply@techy.id. Gunakan limit untuk test (mis: 2).</div>
      <label style={{ fontSize: 12, fontWeight: 700 }}>Subject</label>
      <input value={subject} onChange={e => setSubject(e.target.value)} style={{ width: "100%", border: C.border, borderRadius: 8, padding: "8px 10px", margin: "4px 0 12px", fontFamily: "inherit" }} />
      <label style={{ fontSize: 12, fontWeight: 700 }}>HTML Body</label>
      <textarea value={html} onChange={e => setHtml(e.target.value)} rows={6} style={{ width: "100%", border: C.border, borderRadius: 8, padding: "8px 10px", margin: "4px 0 12px", fontFamily: "inherit", resize: "vertical" }} />
      <label style={{ fontSize: 12, fontWeight: 700 }}>Limit (kosongkan = semua)</label>
      <input value={limit} onChange={e => setLimit(e.target.value.replace(/\D/g, ""))} placeholder="mis: 2" style={{ width: 120, border: C.border, borderRadius: 8, padding: "8px 10px", margin: "4px 0 12px", fontFamily: "inherit" }} />
      <button onClick={send} disabled={sending} style={{ ...btnStyle("#d4ff00"), color: "#000", fontWeight: 800, padding: "10px 16px" }}>{sending ? "Mengirim..." : <><Megaphone size={14} /> Kirim Broadcast</>}</button>
      {result && <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: result.success ? "#efe" : "#fee", color: result.success ? "#080" : "#c00", fontSize: 13 }}>
        {result.success ? `✓ Terkirim: ${result.sent}, Gagal: ${result.failed}, Total: ${result.total}` : `✗ ${result.error}`}
      </div>}
    </div>
  );
}

// ============ helpers ============
function btnStyle(bg: string): React.CSSProperties {
  return { border: C.border, borderRadius: 8, padding: "5px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer", background: bg, color: "#fff", display: "flex", alignItems: "center", gap: 3 };
}
function Pager({ page, total, limit, setPage }: { page: number; total: number; limit: number; setPage: (n: number) => void }) {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
      <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ ...btnStyle("#fff"), color: "#000" }}>← Prev</button>
      <span style={{ alignSelf: "center", fontSize: 13, fontWeight: 700 }}>{page} / {pages}</span>
      <button disabled={page >= pages} onClick={() => setPage(page + 1)} style={{ ...btnStyle("#fff"), color: "#000" }}>Next →</button>
    </div>
  );
}
