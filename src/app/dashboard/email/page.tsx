"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Send, Loader2, Mail, MailOpen, MousePointerClick, Reply, Settings, Plus, Trash2, Star, X } from "lucide-react";
import BottomNav from "@/components/BottomNav";

type Alias = { id: string; local_part: string; domain: string; is_default: number };

function isGmailRecipient(toAddr?: string): boolean {
  if (!toAddr) return false;
  const dom = toAddr.split("@")[1]?.toLowerCase() || "";
  return dom === "gmail.com" || dom === "googlemail.com" || dom === "google.com";
}

export default function DashboardEmailPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"inbox" | "compose" | "sender" | "sent">("inbox");

  // Inbox
  const [emails, setEmails] = useState<any[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<any | null>(null);
  const [emailBody, setEmailBody] = useState("");
  const [inboxLoading, setInboxLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Compose
  const [contacts, setContacts] = useState<any[]>([]);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [selectedAlias, setSelectedAlias] = useState<string>("");

  // Sender settings
  const [newLocal, setNewLocal] = useState("");
  const [newDomain, setNewDomain] = useState("techy.id");
  const [availableDomains, setAvailableDomains] = useState<string[]>(["techy.id"]);
  const [allDomains, setAllDomains] = useState<{ domain: string; resend_status: string; email_status: string; zone_status: string; is_verified: number }[]>([]);
  const [aliasLoading, setAliasLoading] = useState(false);
  const [aliasMsg, setAliasMsg] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [error, setError] = useState("");

  // Sent emails
  const [sentEmails, setSentEmails] = useState<any[]>([]);
  const [sentLoading, setSentLoading] = useState(false);
  const [selectedSent, setSelectedSent] = useState<any | null>(null);
  const [newMailToast, setNewMailToast] = useState(false);
  const [selInbox, setSelInbox] = useState<Set<string>>(new Set());
  const [selSent, setSelSent] = useState<Set<string>>(new Set());
  const [showComposeHelp, setShowComposeHelp] = useState(false);

  // ── Data fetching ──

  const fetchAliases = async () => {
    try {
      const res = await fetch("/api/email-aliases", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setAliases(data.aliases || []);
        // Auto-select default
        const def = (data.aliases || []).find((a: Alias) => a.is_default);
        if (def) setSelectedAlias(`${def.local_part}@${def.domain}`);
        else if (data.aliases?.length) {
          const f = data.aliases[0];
          setSelectedAlias(`${f.local_part}@${f.domain}`);
        }
      }
    } catch {}
  };

  const fetchDomains = async () => {
    try {
      const res = await fetch("/api/domains", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        const domains = data.domains || [];
        // Semua domain (verified + pending + failed) — jangan sembunyikan.
        setAllDomains(domains.map((d: any) => ({
          domain: d.domain,
          resend_status: d.resend_status || "pending",
          email_status: d.email_status || "pending",
          zone_status: d.zone_status || "pending",
          is_verified: d.is_verified ? 1 : 0,
        })));
        // Dropdown alias: semua domain dengan email routing aktif (is_verified=1).
        // Kirim dari alias hanya works kalau Resend verified — dicek di send time.
        const sendable = domains
          .filter((d: any) => d.is_verified)
          .map((d: any) => d.domain);
        setAvailableDomains(["techy.id", ...sendable]);
        if (!sendable.includes(newDomain) && newDomain !== "techy.id") {
          if (!domains.some((d: any) => d.domain === newDomain)) setNewDomain("techy.id");
        }
      }
    } catch {}
  };

  const [syncingDomain, setSyncingDomain] = useState<string | null>(null);
  const handleSyncDomain = async (domain: string) => {
    setSyncingDomain(domain);
    try {
      const res = await fetch("/api/domains", { cache: "no-store" });
      const data = await res.json();
      const target = (data.domains || []).find((d: any) => d.domain === domain);
      if (!target?.id) return;
      const sres = await fetch("/api/domains/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId: target.id }),
      });
      await fetchDomains();
    } catch {} finally {
      setSyncingDomain(null);
    }
  };

  const latestInboxIdRef = useRef<string | null>(null);

  const fetchInbox = async (silent = false) => {
    if (!silent) setInboxLoading(true);
    try {
      const res = await fetch("/api/inbox", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        const list = data.emails || [];
        const newest = list[0]?.id || null;
        if (latestInboxIdRef.current && newest && newest !== latestInboxIdRef.current) {
          setNewMailToast(true);
          setTimeout(() => setNewMailToast(false), 6000);
        }
        latestInboxIdRef.current = newest;
        setEmails(list); setError("");
      }
      else if (!silent) setError(data.error || "Gagal memuat inbox");
    } catch { if (!silent) setError("Gagal memuat inbox"); }
    finally { if (!silent) setInboxLoading(false); }
  };

  const fetchContacts = async () => {
    try {
      const res = await fetch("/api/email/contacts", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setContacts(data.contacts || []);
    } catch {}
  };

  const removeContact = async (address: string) => {
    try {
      await fetch("/api/email/contacts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      setContacts((cs) => cs.filter((c) => c.address !== address));
    } catch {}
  };

  const fetchSent = async (silent = false) => {
    if (!silent) setSentLoading(true);
    try {
      const res = await fetch("/api/sent", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setSentEmails(data.emails || []);
    } catch {}
    finally { if (!silent) setSentLoading(false); }
  };

  const fetchEmailDetail = async (id: string) => {
    setDetailLoading(true); setError("");
    try {
      const res = await fetch(`/api/inbox/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) { setSelectedEmail(data.email); setEmailBody(data.email.body || ""); }
      else setError(data.error || "Gagal memuat email");
    } catch { setError("Gagal memuat email"); }
    finally { setDetailLoading(false); }
  };

  const fetchSentDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/sent/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.email) setSelectedSent(data.email);
    } catch { /* biarkan modal dari data list */ }
  };

  const toggleSelInbox = (id: string) => setSelInbox((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleSelSent = (id: string) => setSelSent((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const selectAllInbox = () => setSelInbox(selInbox.size === emails.length ? new Set() : new Set(emails.map((e) => e.id)));
  const selectAllSent = () => setSelSent(selSent.size === sentEmails.length ? new Set() : new Set(sentEmails.map((e) => e.id)));

  const bulkDeleteInbox = async () => {
    const ids = new Set(selInbox);
    if (!ids.size) return;
    if (!window.confirm(`Hapus ${ids.size} pesan masuk yang dipilih?`)) return;
    await Promise.all(Array.from(ids).map((id) => fetch(`/api/inbox/${id}`, { method: "DELETE" }).catch(() => {})));
    const rest = emails.filter((x) => !ids.has(x.id));
    setEmails(rest);
    latestInboxIdRef.current = rest[0]?.id || null;
    if (selectedEmail && ids.has(selectedEmail.id)) setSelectedEmail(null);
    setSelInbox(new Set());
  };

  const bulkDeleteSent = async () => {
    const ids = new Set(selSent);
    if (!ids.size) return;
    if (!window.confirm(`Hapus ${ids.size} pesan keluar yang dipilih?`)) return;
    await Promise.all(Array.from(ids).map((id) => fetch(`/api/sent/${id}`, { method: "DELETE" }).catch(() => {})));
    setSentEmails((prev) => prev.filter((x) => !ids.has(x.id)));
    if (selectedSent && ids.has(selectedSent.id)) setSelectedSent(null);
    setSelSent(new Set());
  };

  const handleDeleteInbox = async (id: string) => {
    if (!window.confirm("Hapus email ini dari inbox?")) return;
    try {
      const res = await fetch(`/api/inbox/${id}`, { method: "DELETE" });
      if (res.ok) { setEmails((e) => e.filter((x) => x.id !== id)); setSelectedEmail(null); }
      else setError("Gagal menghapus email");
    } catch { setError("Gagal menghapus email"); }
  };

  const handleDeleteSent = async (id: string) => {
    if (!window.confirm("Hapus email terkirim ini?")) return;
    try {
      const res = await fetch(`/api/sent/${id}`, { method: "DELETE" });
      if (res.ok) { setSentEmails((e) => e.filter((x) => x.id !== id)); setSelectedSent(null); }
      else setError("Gagal menghapus email");
    } catch { setError("Gagal menghapus email"); }
  };

  // ── Actions ──

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.trim() || !subject.trim() || !body.trim()) {
      setSendStatus({ type: "error", msg: "Semua field harus diisi" }); return;
    }
    setSending(true); setSendStatus(null);
    try {
      const recipients = to.split(",").map(e => e.trim()).filter(e => e);
      for (const recipient of recipients) {
        const res = await fetch("/api/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: recipient, subject, html: body.replace(/\n/g, "<br/>"), fromAddress: selectedAlias || undefined }),
        });
        if (!res.ok) {
          const data = await res.json();
          setSendStatus({ type: "error", msg: data.error || "Gagal mengirim email" });
          setSending(false); return;
        }
      }
      setSendStatus({ type: "success", msg: `Terkirim ke ${recipients.length} penerima` });
      setTo(""); setSubject(""); setBody("");
      setTimeout(() => setSendStatus(null), 3000);
    } catch { setSendStatus({ type: "error", msg: "Gagal mengirim email" }); }
    finally { setSending(false); }
  };

  const handleReply = () => {
    if (!selectedEmail) return;
    setTo(selectedEmail.from);
    setSubject(selectedEmail.subject?.startsWith("Re: ") ? selectedEmail.subject : `Re: ${selectedEmail.subject || ""}`);
    setBody(""); setTab("compose");
  };

  const handleAddAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    const lp = newLocal.trim().toLowerCase();
    if (!lp) { setAliasMsg({ type: "error", msg: "Nama tidak boleh kosong" }); return; }
    setAliasLoading(true); setAliasMsg(null);
    try {
      const res = await fetch("/api/email-aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ local_part: lp, domain: newDomain }),
      });
      const data = await res.json();
      if (res.ok) {
        setAliasMsg({ type: "success", msg: `${lp}@${newDomain} ditambahkan` });
        setNewLocal(""); fetchAliases();
      } else {
        setAliasMsg({ type: "error", msg: data.error || "Gagal menambah" });
      }
    } catch { setAliasMsg({ type: "error", msg: "Gagal menambah" }); }
    finally { setAliasLoading(false); setTimeout(() => setAliasMsg(null), 3000); }
  };

  const handleDeleteAlias = async (id: string) => {
    try {
      await fetch("/api/email-aliases", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchAliases();
    } catch {}
  };

  const handleSetDefault = async (alias: Alias) => {
    try {
      // Delete + re-create as default (simple approach)
      await fetch("/api/email-aliases", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: alias.id }),
      });
      const res = await fetch("/api/email-aliases", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ local_part: alias.local_part, domain: alias.domain, is_default: true }),
      });
      if (res.ok) fetchAliases();
    } catch {}
  };

  // ── Effects ──

  useEffect(() => {
    fetchAliases();
    fetchDomains();
  }, []);

  useEffect(() => {
    if (tab === "inbox") { fetchInbox(); setSelectedEmail(null); }
    if (tab === "sent") { fetchSent(); }
    if (tab === "compose") { fetchContacts(); }
  }, [tab]);

  // ── Live update: polling senyap tiap 15 detik (tanpa refresh manual) ──
  // Inbox: email baru langsung muncul. Sent: status Dibuka/DIKLIK langsung berubah.
  // Pause saat tab browser tidak aktif (hemat baterai/data), resume langsung saat aktif.
  const selectedSentRef = useRef<any | null>(null);
  selectedSentRef.current = selectedSent;
  useEffect(() => {
    if (tab !== "inbox" && tab !== "sent") return;
    const tick = () => {
      if (document.hidden) return;
      if (tab === "inbox") fetchInbox(true);
      else {
        fetchSent(true);
        if (selectedSentRef.current) fetchSentDetail(selectedSentRef.current.id);
      }
    };
    const iv = setInterval(tick, 15000);
    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [tab]);

  // ── Helpers ──

  const fmtSentDate = (dt?: string) => {
    if (!dt) return "-";
    try {
      // SQLite datetime('now') is UTC "YYYY-MM-DD HH:MM:SS"
      const d = new Date(dt.replace(" ", "T") + "Z");
      if (isNaN(d.getTime())) return dt;
      return d.toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch { return dt || "-"; }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts * 1000), now = new Date();
    const dm = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (dm < 1) return "Baru saja";
    if (dm < 60) return `${dm}m lalu`;
    const dh = Math.floor(dm / 60);
    if (dh < 24) return `${dh}h lalu`;
    const dd = Math.floor(dh / 24);
    if (dd < 7) return `${dd}d lalu`;
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  };

  const truncate = (s: string, n = 32) => s?.length > n ? s.slice(0, n) + "…" : s || "";

  const S = {
    card: { background: "#fff", border: "2px solid #000", boxShadow: "4px 4px 0 #000" } as React.CSSProperties,
    btn: { border: "2px solid #000", padding: "8px 14px", fontWeight: 800, fontSize: 13, cursor: "pointer", boxShadow: "3px 3px 0 #000" } as React.CSSProperties,
    input: { width: "100%", padding: "10px 12px", border: "2px solid #000", fontSize: 14 } as React.CSSProperties,
    label: { display: "block", fontWeight: 800, marginBottom: 6, fontSize: 13 } as React.CSSProperties,
  };

  return (
    <main style={{ minHeight: "100vh", background: "#F5F5F0", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: "#BEEE11", borderBottom: "3px solid #000", padding: "14px 16px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => router.push("/dashboard")} style={{ ...S.btn, background: "#fff" }}>← Dashboard</button>
          <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>📧 Email</h1>
          <div style={{ width: 90 }}></div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px", marginTop: 16 }}>
        <div style={{ display: "flex", gap: 0, borderBottom: "3px solid #000" }}>
          {([["inbox", "📥 Inbox"], ["compose", "✏️ Kirim"], ["sent", "📤 Terkirim"], ["sender", "⚙️ Pengirim"]] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "10px 18px", fontWeight: 800, fontSize: 13, cursor: "pointer",
              border: tab === t ? "3px solid #000" : "3px solid transparent",
              borderBottom: tab === t ? "3px solid #F5F5F0" : "3px solid transparent",
              background: tab === t ? "#BEEE11" : "transparent",
              marginBottom: -3, zIndex: tab === t ? 1 : 0, position: "relative" as const,
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px" }}>

        {/* ═══ INBOX ═══ */}
        {tab === "inbox" && (
          <div>
            {selectedEmail ? (
              <div>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <button onClick={() => { setSelectedEmail(null); setEmailBody(""); setError(""); }} style={{ ...S.btn, background: "#fff" }}>
                    <ChevronLeft size={14} style={{ verticalAlign: -2 }} /> Kembali
                  </button>
                  <button onClick={handleReply} style={{ ...S.btn, background: "#BEEE11" }}>
                    <Reply size={14} style={{ verticalAlign: -2 }} /> Balas
                  </button>
                </div>
                <div style={{ ...S.card, boxShadow: "5px 5px 0 #000" }}>
                  <div style={{ borderBottom: "2px solid #000", padding: "16px 20px", background: "#F5F5F0" }}>
                    <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 10px 0" }}>{selectedEmail.subject || "(tanpa subjek)"}</h2>
                    <div style={{ fontSize: 13, color: "#444", display: "flex", flexDirection: "column", gap: 4 }}>
                      <div><span style={{ color: "#888" }}>Dari:</span> <strong>{selectedEmail.from}</strong></div>
                      <div><span style={{ color: "#888" }}>Kepada:</span> <strong>{selectedEmail.to}</strong></div>
                      <div><span style={{ color: "#888" }}>Tanggal:</span> {new Date(selectedEmail.receivedAt * 1000).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" })}</div>
                    </div>
                  </div>
                  <div style={{ padding: 20, fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "break-word", maxWidth: "100%", fontFamily: "system-ui, sans-serif", color: "#222", minHeight: 80 }}>
                    {detailLoading ? (
                      <div style={{ textAlign: "center", padding: 30, color: "#888" }}><Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /></div>
                    ) : emailBody ? <div dangerouslySetInnerHTML={{ __html: emailBody }} /> : <span style={{ color: "#aaa", fontStyle: "italic" }}>Tidak ada isi pesan</span>}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {inboxLoading ? (
                  <div style={{ textAlign: "center", padding: 50, color: "#888" }}><Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} /><p style={{ marginTop: 8, fontWeight: "bold" }}>Memuat inbox...</p></div>
                ) : error ? (
                  <div style={{ background: "#fee", border: "3px solid #f00", padding: 16, color: "#c00", fontWeight: "bold", boxShadow: "4px 4px 0 #f00" }}>{error}</div>
                ) : emails.length === 0 ? (
                  <div style={{ ...S.card, padding: 40, textAlign: "center", boxShadow: "5px 5px 0 #000" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                    <div style={{ fontWeight: "bold", fontSize: 16, marginBottom: 6 }}>Inbox kosong</div>
                    <div style={{ color: "#888", fontSize: 13 }}>Email masuk ke domain kamu akan muncul di sini</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {selInbox.size > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "2px solid #000", background: "#BEEE11", fontWeight: 800, fontSize: 12, boxShadow: "3px 3px 0 #000", flexWrap: "wrap" }}>
                        <span>{selInbox.size} dipilih</span>
                        <button type="button" onClick={selectAllInbox} style={{ border: "2px solid #000", background: "#fff", cursor: "pointer", padding: "3px 8px", fontSize: 11, fontWeight: 800 }}>{selInbox.size === emails.length ? "Batal pilih semua" : "Pilih semua"}</button>
                        <button type="button" onClick={bulkDeleteInbox} style={{ border: "2px solid #000", background: "#f66", color: "#600", cursor: "pointer", padding: "3px 8px", fontSize: 11, fontWeight: 900 }}>🗑 Hapus {selInbox.size}</button>
                        <button type="button" onClick={() => setSelInbox(new Set())} style={{ border: "none", background: "transparent", cursor: "pointer", fontWeight: 900, fontSize: 13 }}>✕</button>
                      </div>
                    )}
                    {emails.map((email) => (
                      <div key={email.id} data-testid="inbox-item" onClick={() => fetchEmailDetail(email.id)}
                        style={{
                          background: email.isRead ? "#fff" : "#FFFBEB", border: "2px solid #000", padding: "14px 16px",
                          cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                          boxShadow: email.isRead ? "3px 3px 0 #ddd" : "4px 4px 0 #000",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translate(-1px,-1px)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "none"; }}
                      >
                        <input type="checkbox" checked={selInbox.has(email.id)} onChange={() => toggleSelInbox(email.id)} onClick={(e) => e.stopPropagation()} aria-label={`Pilih ${email.subject || "pesan"}`} style={{ width: 18, height: 18, accentColor: "#000", cursor: "pointer", flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            {email.isRead ? <MailOpen size={16} color="#aaa" /> : <Mail size={16} color="#FF6B35" />}
                            <span style={{ fontWeight: email.isRead ? 600 : 900, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email.subject || "(tanpa subjek)"}</span>
                            {!email.isRead && <span style={{ background: "#FF6B35", color: "#fff", fontSize: 10, fontWeight: 900, padding: "2px 6px", borderRadius: 2, flexShrink: 0 }}>BARU</span>}
                            {email.spamScore >= 3 && <span title={`Pencetus: ${email.spamReasons || "-"}`} style={{ background: "#dc2626", color: "#fff", fontSize: 10, fontWeight: 900, padding: "2px 6px", borderRadius: 2, flexShrink: 0 }}>⚠ SPAM?</span>}
                          </div>
                          <div style={{ fontSize: 12, color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email.from}</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                          <div style={{ fontSize: 11, color: "#999", fontWeight: 600 }}>{formatDate(email.receivedAt)}</div>
                          <button aria-label="Hapus pesan masuk" onClick={(e) => { e.stopPropagation(); handleDeleteInbox(email.id); }} style={{ border: "2px solid #000", background: "#fff", cursor: "pointer", padding: "2px 6px", fontSize: 12, fontWeight: 800, boxShadow: "2px 2px 0 #000" }}>🗑</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ SENT ═══ */}
        {tab === "sent" && (
          <div>
            {sentLoading ? (
              <div style={{ textAlign: "center", padding: 50, color: "#888" }}><Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} /><p style={{ marginTop: 8, fontWeight: "bold" }}>Memuat...</p></div>
            ) : sentEmails.length === 0 ? (
              <div style={{ ...S.card, padding: 40, textAlign: "center", boxShadow: "5px 5px 0 #000" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📤</div>
                <div style={{ fontWeight: "bold", fontSize: 16, marginBottom: 6 }}>Belum ada email terkirim</div>
                <div style={{ color: "#888", fontSize: 13 }}>Email yang kamu kirim akan tercatat di sini beserta status dibaca</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {selSent.size > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "2px solid #000", background: "#BEEE11", fontWeight: 800, fontSize: 12, boxShadow: "3px 3px 0 #000", flexWrap: "wrap" }}>
                    <span>{selSent.size} dipilih</span>
                    <button type="button" onClick={selectAllSent} style={{ border: "2px solid #000", background: "#fff", cursor: "pointer", padding: "3px 8px", fontSize: 11, fontWeight: 800 }}>{selSent.size === sentEmails.length ? "Batal pilih semua" : "Pilih semua"}</button>
                    <button type="button" onClick={bulkDeleteSent} style={{ border: "2px solid #000", background: "#f66", color: "#600", cursor: "pointer", padding: "3px 8px", fontSize: 11, fontWeight: 900 }}>🗑 Hapus {selSent.size}</button>
                    <button type="button" onClick={() => setSelSent(new Set())} style={{ border: "none", background: "transparent", cursor: "pointer", fontWeight: 900, fontSize: 13 }}>✕</button>
                  </div>
                )}
                {sentEmails.map((e) => (
                  <div key={e.id} data-testid="sent-item" onClick={() => fetchSentDetail(e.id)} style={{
                    background: "#fff", border: "2px solid #000", padding: "14px 16px", cursor: "pointer",
                    boxShadow: "3px 3px 0 #ddd", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                  }}>
                    <input type="checkbox" checked={selSent.has(e.id)} onChange={() => toggleSelSent(e.id)} onClick={(ev) => ev.stopPropagation()} aria-label={`Pilih ${e.subject || "pesan"}`} style={{ width: 18, height: 18, accentColor: "#000", cursor: "pointer", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        {e.status === "clicked" ? <MousePointerClick size={16} color="#7c3aed" /> : e.status === "opened" ? <MailOpen size={16} color="#16a34a" /> : <Mail size={16} color="#888" />}
                        <span style={{ fontWeight: 800, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.subject || "(tanpa subjek)"}</span>
                        {e.hit_count > 1
                          ? <span title={isGmailRecipient(e.to_addr) ? "Gmail membatasi data via proxy caching — angka ini batas MINIMAL, jumlah buka sebenarnya bisa lebih" : "jumlah gambar email di-fetch (reload/manual)"} style={{ background: "#f59e0b", color: "#fff", fontSize: 10, fontWeight: 900, padding: "2px 6px", borderRadius: 2, flexShrink: 0 }}>DIBUKA {isGmailRecipient(e.to_addr) ? ">=" : ""}{e.hit_count}x</span>
                          : null}
                        {e.status === "clicked"
                          ? <span style={{ background: "#7c3aed", color: "#fff", fontSize: 10, fontWeight: 900, padding: "2px 6px", borderRadius: 2, flexShrink: 0 }}>DIKLIK</span>
                          : e.status === "opened"
                          ? <span title={isGmailRecipient(e.to_addr) ? "Gmail: minimal 1x dibuka (data dibatasi proxy caching Gmail)" : ""} style={{ background: "#16a34a", color: "#fff", fontSize: 10, fontWeight: 900, padding: "2px 6px", borderRadius: 2, flexShrink: 0 }}>{isGmailRecipient(e.to_addr) ? "DIBACA \u22651x" : "DIBACA"}</span>
                          : <span style={{ background: "#ddd", color: "#555", fontSize: 10, fontWeight: 900, padding: "2px 6px", borderRadius: 2, flexShrink: 0 }}>TERKIRIM</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "#666" }}>→ {e.to_addr} · {e.from_addr}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                      <div style={{ fontSize: 11, color: "#999", fontWeight: 600, textAlign: "right", lineHeight: 1.4 }}>
                        <div>Terkirim {fmtSentDate(e.created_at)}</div>
                        {e.status === "opened" && e.opened_at && (
                          <div style={{ color: "#16a34a" }}>Dibuka {fmtSentDate(e.opened_at)}</div>
                        )}
                        {e.status === "clicked" && e.clicked_at && (
                          <div style={{ color: "#7c3aed" }}>Diklik {fmtSentDate(e.clicked_at)}</div>
                        )}
                      </div>
                      <button aria-label="Hapus email terkirim" onClick={(ev) => { ev.stopPropagation(); handleDeleteSent(e.id); }} style={{ border: "2px solid #000", background: "#fff", cursor: "pointer", padding: "2px 6px", fontSize: 12, fontWeight: 800, boxShadow: "2px 2px 0 #000" }}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ COMPOSE ═══ */}
        {tab === "compose" && (
          <div style={{ maxWidth: 600 }}>
            <form onSubmit={handleSendEmail}>
              {/* From picker */}
              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Dari</label>
                {aliases.length > 0 ? (
                  <select value={selectedAlias} onChange={(e) => setSelectedAlias(e.target.value)} style={{ ...S.input, background: "#fff", fontWeight: 600 }}>
                    {aliases.map((a) => <option key={a.id} value={`${a.local_part}@${a.domain}`}>{a.local_part}@{a.domain}{a.is_default ? " ★" : ""}</option>)}
                  </select>
                ) : (
                  <div style={{ padding: "10px 12px", border: "2px dashed #999", fontSize: 12, color: "#666", background: "#fafafa" }}>
                    Belum ada alias. Buka tab <b>⚙️ Pengirim</b> untuk bikin alamat email kamu.
                  </div>
                )}
              </div>

              {contacts.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: "#666", fontWeight: 700, marginBottom: 4 }}>PERNAH DIKIRIMI — geser ↔ gulir · klik untuk pakai · ✕ hapus</div>
                  <div style={{ display: "flex", flexWrap: "nowrap", gap: 6, overflowX: "auto", paddingBottom: 6, WebkitOverflowScrolling: "touch", scrollbarWidth: "thin" }}>
                    {contacts.map((c) => (
                      <span key={c.address} onClick={() => setTo((t) => { const parts = t.split(/[,;]\s*/).map((x) => x.trim()).filter(Boolean); if (!parts.includes(c.address)) parts.push(c.address); return parts.join(", "); })} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 9px", border: "2px solid #000", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", boxShadow: "2px 2px 0 #000", whiteSpace: "nowrap", flexShrink: 0 }}>
                        {c.address}
                        <span style={{ color: "#999", fontSize: 10 }}>({c.count}x)</span>
                        <button type="button" aria-label={`Hapus ${c.address}`} onClick={(e) => { e.stopPropagation(); removeContact(c.address); }} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, display: "flex", color: "#c00" }}><X size={12} /></button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Kepada</label>
                <input type="text" value={to} onChange={(e) => setTo(e.target.value)} placeholder="email@contoh.com, email2@contoh.com" style={S.input} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Subjek</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subjek email" style={S.input} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Isi pesan</label>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Tulis pesan..." style={{ ...S.input, minHeight: 180, fontFamily: "system-ui, sans-serif", resize: "vertical" }} />
              </div>

              {sendStatus && (
                <div style={{ marginBottom: 16, padding: "10px 14px", fontWeight: "bold", fontSize: 13,
                  background: sendStatus.type === "success" ? "#efe" : "#fee",
                  border: `2px solid ${sendStatus.type === "success" ? "#0a0" : "#f00"}`,
                  color: sendStatus.type === "success" ? "#060" : "#c00",
                  boxShadow: `3px 3px 0 ${sendStatus.type === "success" ? "#0a0" : "#f00"}` }}>{sendStatus.msg}</div>
              )}

              <button type="submit" disabled={sending} style={{ width: "100%", padding: 12, background: "#BEEE11", border: "3px solid #000", fontWeight: 900, fontSize: 15, cursor: sending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "4px 4px 0 #000", opacity: sending ? 0.6 : 1 }}>
                {sending ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Mengirim...</> : <><Send size={16} /> Kirim Email</>}
              </button>

              {/* Help / FAQ toggle */}
              <button type="button" onClick={() => setShowComposeHelp((v) => !v)} style={{ width: "100%", marginTop: 10, padding: 10, background: "#fff", border: "2px solid #000", fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                ❓ Tanya seputar email
              </button>
              {showComposeHelp && (
                <div style={{ marginTop: 10, border: "2px solid #000", background: "#fafafa", padding: 14, fontSize: 13, lineHeight: 1.7 }}>
                  <p style={{ margin: "0 0 8px" }}><b>📤 Tab Terkirim?</b> Riwayat semua email yang kamu kirim + status <b>DIBACA</b> (penerima membuka email). Status cuma akurat jika penerima membiarkan gambar dimuat (Gmail menyalakan secara default; beberapa klien memblokirnya).</p>
                  <p style={{ margin: "0 0 8px" }}><b>✉️ Alamat pengirim?</b> Pakai alias <b>@techy.id</b> (gratis) atau domain custom. Atur di tab <b>Pengirim</b>.</p>
                  <p style={{ margin: 0 }}><b>📥 Balasan?</b> Masuk ke tab <b>Inbox</b> (jika domain sudah verifikasi + Email Routing aktif).</p>
                </div>
              )}
            </form>
          </div>
        )}

        {/* ═══ SENDER SETTINGS ═══ */}
        {tab === "sender" && (
          <div style={{ maxWidth: 600 }}>
            {/* Info box */}
            <div style={{ ...S.card, padding: 16, marginBottom: 20, background: "#FFFBEB", boxShadow: "4px 4px 0 #000" }}>
              <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 6 }}>💡 Alamat Pengirim</div>
              <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6 }}>
                Atur alamat email yang dipakai saat kirim email. Kamu bisa bikin alamat pakai <b>techy.id</b> (gratis) atau domain custom kamu sendiri. Yang ditandai ★ jadi pengirim default.
              </div>
            </div>

            {/* Add new alias */}
            <form onSubmit={handleAddAlias} style={{ ...S.card, padding: 20, marginBottom: 20 }}>
              <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 14 }}>➕ Tambah Alamat Baru</div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <label style={S.label}>Nama</label>
                  <input type="text" value={newLocal} onChange={(e) => setNewLocal(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))} placeholder="halo" style={S.input} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, paddingBottom: 10 }}>@</div>
                <div style={{ flex: 1 }}>
                  <label style={S.label}>Domain</label>
                  <select value={newDomain} onChange={(e) => setNewDomain(e.target.value)} style={{ ...S.input, background: "#fff" }}>
                    {availableDomains.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <button type="submit" disabled={aliasLoading} style={{ ...S.btn, background: "#BEEE11", paddingBottom: 10, paddingTop: 10 }}>
                  {aliasLoading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={14} />}
                </button>
              </div>
              {aliasMsg && (
                <div style={{ marginTop: 10, padding: "8px 12px", fontSize: 12, fontWeight: "bold",
                  background: aliasMsg.type === "success" ? "#efe" : "#fee",
                  border: `2px solid ${aliasMsg.type === "success" ? "#0a0" : "#f00"}`,
                  color: aliasMsg.type === "success" ? "#060" : "#c00" }}>{aliasMsg.msg}</div>
              )}
            </form>

            {/* Current aliases */}
            <div style={{ ...S.card, padding: 20, boxShadow: "4px 4px 0 #000" }}>
              <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 14 }}>📋 Alamat Aktif</div>
              {aliases.length === 0 ? (
                <div style={{ color: "#888", fontSize: 13, padding: "12px 0" }}>Belum ada alamat. Tambah di atas.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {aliases.map((a) => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", border: "2px solid #000", background: a.is_default ? "#FFFBEB" : "#fff" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontWeight: 800, fontSize: 14 }}>{a.local_part}@{a.domain}</span>
                        {a.is_default ? (
                          <span style={{ background: "#BEEE11", fontSize: 10, fontWeight: 900, padding: "2px 8px", border: "1px solid #000" }}>★ DEFAULT</span>
                        ) : (
                          <button onClick={() => handleSetDefault(a)} style={{ background: "transparent", border: "1px solid #999", fontSize: 10, padding: "2px 8px", cursor: "pointer", color: "#666" }}>
                            <Star size={10} style={{ verticalAlign: -1 }} /> Jadikan default
                          </button>
                        )}
                      </div>
                      <button onClick={() => handleDeleteAlias(a.id)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#c00", padding: 4 }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Domain list with email-sending verification status */}
            <div style={{ ...S.card, padding: 20, boxShadow: "4px 4px 0 #000", marginTop: 20 }}>
              <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 6 }}>🌐 Domain Kamu</div>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 14, lineHeight: 1.5 }}>
                <b>Terima email</b> (Cloudflare Email Routing): unlimited, langsung aktif untuk semua domain.<br />
                <b>Kirim email</b> (Resend): maksimal 3 domain. Status <b>✓ Kirim</b> = bisa kirim, <b>⏳</b> = belum verified.
                <br />Kalau domain utama sudah punya MX lain (Zoho/Workspace), buat <b>subdomain</b> (mis. <code>email.{newDomain === "techy.id" ? "domain.com" : newDomain}</code>) sebagai domain baru untuk email.
              </div>
              {allDomains.length === 0 ? (
                <div style={{ color: "#888", fontSize: 13, padding: "12px 0" }}>Belum ada domain. Tambah di menu Domain.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {allDomains.map((d) => {
                    const recvOk = d.is_verified === 1 || d.email_status === "active";
                    const sendOk = d.resend_status === "verified";
                    return (
                      <div key={d.domain} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", border: "2px solid #000", background: "#fff" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 800, fontSize: 14 }}>{d.domain}</span>
                          <span style={{ background: recvOk ? "#d4ff00" : "#fff7d6", fontSize: 10, fontWeight: 900, padding: "2px 8px", border: "1px solid #000" }}>
                            {recvOk ? "✓ Terima aktif" : "⏳ Terima"}
                          </span>
                          <span style={{ background: sendOk ? "#d4ff00" : (d.resend_status === "failed" ? "#fee2e2" : "#fff7d6"), fontSize: 10, fontWeight: 900, padding: "2px 8px", border: "1px solid #000" }}>
                            {sendOk ? "✓ Kirim" : d.resend_status === "failed" ? "✗ Kirim gagal" : "⏳ Kirim"}
                          </span>
                        </div>
                        {!sendOk && (
                          <button onClick={() => handleSyncDomain(d.domain)} disabled={syncingDomain === d.domain} style={{ border: "2px solid #000", background: syncingDomain === d.domain ? "#ddd" : "#BEEE11", fontWeight: 800, fontSize: 12, padding: "5px 12px", cursor: "pointer", boxShadow: "2px 2px 0 #000" }}>
                            {syncingDomain === d.domain ? "Syncing..." : "Sync"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <BottomNav active="email" />

      {/* ═══ SENT DETAIL MODAL ═══ */}
      {newMailToast && (
        <div onClick={() => { setNewMailToast(false); fetchInbox(); }} style={{ position: "fixed", bottom: 18, left: "50%", transform: "translateX(-50%)", zIndex: 9999, background: "#000", color: "#BEEE11", border: "2px solid #BEEE11", padding: "10px 16px", fontWeight: 900, fontSize: 13, cursor: "pointer", boxShadow: "4px 4px 0 rgba(0,0,0,.35)", whiteSpace: "nowrap" }}>
          📬 Email baru masuk — ketuk untuk lihat
        </div>
      )}

      {selectedSent && (
        <div onClick={() => setSelectedSent(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 500 }}>
          <div onClick={(ev) => ev.stopPropagation()} style={{ background: "#fff", border: "3px solid #000", boxShadow: "8px 8px 0 #000", maxWidth: 600, width: "100%", maxHeight: "85vh", overflow: "auto" }}>
            <div style={{ background: "#BEEE11", borderBottom: "3px solid #000", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>📤 Detail Email Terkirim</h3>
              <button onClick={() => setSelectedSent(null)} style={{ ...S.btn, background: "#fff" }}>✕</button>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#888", textTransform: "uppercase" }}>Subjek</div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{selectedSent.subject || "(tanpa subjek)"}</div>
              </div>
              <div style={{ display: "flex", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
                <div><div style={{ fontSize: 11, fontWeight: 800, color: "#888", textTransform: "uppercase" }}>Kepada</div><div style={{ fontSize: 13 }}>{selectedSent.to_addr}</div></div>
                <div><div style={{ fontSize: 11, fontWeight: 800, color: "#888", textTransform: "uppercase" }}>Dari</div><div style={{ fontSize: 13 }}>{selectedSent.from_addr}</div></div>
              </div>
              <div style={{ display: "flex", gap: 16, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
                <div><div style={{ fontSize: 11, fontWeight: 800, color: "#888", textTransform: "uppercase" }}>Status</div>
                  {selectedSent.status === "clicked"
                    ? <span style={{ background: "#7c3aed", color: "#fff", fontSize: 11, fontWeight: 900, padding: "3px 8px", borderRadius: 2 }}>DIKLIK {selectedSent.clicked_at ? fmtSentDate(selectedSent.clicked_at) : ""}</span>
                    : selectedSent.status === "opened"
                    ? <span style={{ background: "#16a34a", color: "#fff", fontSize: 11, fontWeight: 900, padding: "3px 8px", borderRadius: 2 }}>DIBACA {selectedSent.opened_at ? fmtSentDate(selectedSent.opened_at) : ""}</span>
                    : <span style={{ background: "#ddd", color: "#555", fontSize: 11, fontWeight: 900, padding: "3px 8px", borderRadius: 2 }}>TERKIRIM</span>}
                </div>
                <div><div style={{ fontSize: 11, fontWeight: 800, color: "#888", textTransform: "uppercase" }}>Dikirim</div><div style={{ fontSize: 13 }}>{fmtSentDate(selectedSent.created_at)}</div></div>
                <div><div style={{ fontSize: 11, fontWeight: 800, color: "#888", textTransform: "uppercase" }}>Gambar di-fetch</div><div style={{ fontSize: 13 }}>{selectedSent.hit_count || 0}x{selectedSent.last_hit_at ? " \u00b7 terakhir " + fmtSentDate(selectedSent.last_hit_at) : ""}{isGmailRecipient(selectedSent.to_addr) ? <span style={{ color: "#b45309", fontSize: 11, fontWeight: 700 }}> \u00b7 Gmail: minimal, dibatasi caching</span> : null}</div></div>
                <div><div style={{ fontSize: 11, fontWeight: 800, color: "#888", textTransform: "uppercase" }}>Klik</div><div style={{ fontSize: 13 }}>{selectedSent.click_count || 0}x</div></div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Isi Pesan</div>
              <div style={{ border: "2px solid #000", padding: 12, background: "#fafafa", fontSize: 14, lineHeight: 1.5, wordBreak: "break-word" }}
                dangerouslySetInnerHTML={{ __html: selectedSent.body || "<i>(tidak ada isi / teks polos)</i>" }} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
