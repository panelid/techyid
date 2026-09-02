"use client";

import { useState, useEffect } from "react";
import { CheckCircle, ChevronDown, Copy, Globe } from "lucide-react";

type Domain = {
  id: string;
  domain: string;
  domain_type?: string;
  parent_domain?: string;
  zone_id?: string;
  zone_status?: string;
  worker_status?: string;
  email_status?: string;
  resend_status?: string;
  is_verified?: boolean;
  nameservers?: string[];
  provision_error?: string;
  created_at: string;
  source?: "db" | "resend"; // resend = only exists in Resend, not in Door DB
};

export default function CustomDomainManager() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [copiedNs, setCopiedNs] = useState<string | null>(null);
  const [emailSubdomain, setEmailSubdomain] = useState("");
  const [resendDomains, setResendDomains] = useState<any[]>([]);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    fetchDomains();
    fetchResendDomains();
  }, []);

  const fetchDomains = async () => {
    try {
      const res = await fetch("/api/domains", { cache: "no-store" });
      if (!res.ok) throw new Error(`Gagal memuat domain (${res.status})`);
      const data = await res.json();
      setDomains((data.domains || []).map((d: Domain) => ({ ...d, source: "db" })));
    } catch (err: any) {
      setError(err.message || "Failed to load domains");
    } finally {
      setLoading(false);
    }
  };

  const fetchResendDomains = async () => {
    setResendLoading(true);
    try {
      const res = await fetch("/api/domains/resend-list", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const rd = (data.domains || []).map((d: any) => ({
        id: d.id,
        domain: d.name,
        resend_status: d.status,
        source: "resend" as const,
        created_at: "",
      }));
      setResendDomains(rd);
    } catch {} finally {
      setResendLoading(false);
    }
  };

  // Merge DB + Resend domains, dedupe by domain name
  // Rules:
  // - x.door.id = system domain, never shown
  // - DB domains = user custom domains (always shown)
  // - Resend-only domains (not in DB, not x.door.id) = orphan, shown with delete button
  const SYSTEM_DOMAINS = ["x.door.id", "door.id", "dalil.workers.dev"];
  const allDomains = (() => {
    const map = new Map<string, Domain>();
    for (const d of domains) {
      if (SYSTEM_DOMAINS.includes(d.domain)) continue;
      map.set(d.domain, d);
    }
    for (const r of resendDomains) {
      if (SYSTEM_DOMAINS.includes(r.domain)) continue;
      if (!map.has(r.domain)) {
        map.set(r.domain, { ...r, source: "resend" });
      } else {
        const existing = map.get(r.domain)!;
        existing.resend_status = r.resend_status;
      }
    }
    return Array.from(map.values());
  })();

  const deleteResendDomain = async (resendId: string, name: string) => {
    if (!window.confirm(`Hapus "${name}" dari Resend?`)) return;
    setBusyId(resendId);
    try {
      const res = await fetch("/api/domains/resend-list", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId: resendId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal hapus");
      fetchResendDomains();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleAdd = async () => {
    const trimmed = newDomain.trim().toLowerCase().replace(/\.$/, "");
    if (!trimmed) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Permintaan gagal (HTTP ${res.status})`);
      setNewDomain("");
      setExpandedId(data.domain?.id || null);
      // Auto-sync email after add (zone is ready → register Resend)
      if (data.domain?.id && data.domain?.zone_status === "active") {
        await callSync(data.domain.id);
      }
      fetchDomains();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const callSync = async (domainId: string) => {
    setBusyId(domainId);
    setRowErrors((c) => ({ ...c, [domainId]: "" }));
    try {
      const res = await fetch("/api/domains/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Permintaan gagal (HTTP ${res.status})`);
      // Zone belum aktif di Cloudflare = Recheck tidak bisa lanjut. Sampaikan, jangan silent.
      if (data.zone_status && data.zone_status !== "active") {
        setRowErrors((c) => ({ ...c, [domainId]: `Zone masih "${data.zone_status}" di Cloudflare — nameserver sudah benar, tinggal tunggu sistem Cloudflare memverifikasi (biasanya beberapa menit s.d. 24 jam). Klik Recheck lagi nanti.` }));
      }
      await fetchDomains();
    } catch (err: any) {
      setRowErrors((c) => ({ ...c, [domainId]: err.message }));
    } finally {
      setBusyId(null);
    }
  };

  const handleAddEmailSubdomain = async () => {
    const trimmed = emailSubdomain.trim().toLowerCase().replace(/\.$/, "");
    if (!trimmed) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Permintaan gagal (HTTP ${res.status})`);
      setEmailSubdomain("");
      setExpandedId(data.domain?.id || null);
      fetchDomains();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteResend = async (domainId: string) => {
    if (!window.confirm("Hapus domain dari Resend? Slot akan terbuka untuk domain lain.")) return;
    setBusyId(domainId);
    try {
      const res = await fetch("/api/domains/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId, action: "delete_resend" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus dari Resend");
      fetchDomains();
    } catch (err: any) {
      setRowErrors((c) => ({ ...c, [domainId]: err.message }));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (domainId: string, domainName: string) => {
    if (!window.confirm(`Hapus domain "${domainName}"?\n\nIni akan menghapus resource yang dibuat Door.id:\n- Email routing rule\n- Worker domain attachment\n- DNS records Resend\n- Domain dari Resend\n- Data dari Door.id\n\nZone Cloudflare kamu TIDAK dihapus.\n\nTindakan tidak bisa dibatalkan.`)) return;
    setBusyId(domainId);
    try {
      const res = await fetch(`/api/domains/${domainId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Permintaan gagal (HTTP ${res.status})`);
      fetchDomains();
      fetchResendDomains();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const copyNs = async (ns: string) => {
    try {
      await navigator.clipboard.writeText(ns);
      setCopiedNs(ns);
      setTimeout(() => setCopiedNs(null), 1500);
    } catch {}
  };

  const statusBadge = (d: Domain) => {
    if (d.domain_type === "email_only") {
      if (d.resend_status === "verified") {
        return <span style={{ ...S.badge, background: "#d4ff00", color: "#000" }}>✓ Email Only</span>;
      }
      const rs = d.resend_status || "pending";
      const bg = rs === "failed" ? "#fee2e2" : "#fff7d6";
      const label = rs === "failed" ? "✗ Email gagal" : "📧 Email Only";
      return <span style={{ ...S.badge, background: bg }}>{label}</span>;
    }
    if (d.is_verified && (d.resend_status === "verified")) {
      return (
        <span style={{ ...S.badge, background: "#d4ff00", color: "#000" }}>
          ✓ Domain + Email
        </span>
      );
    }
    if (d.is_verified && d.resend_status !== "verified") {
      const rs = d.resend_status || "pending";
      const bg = rs === "failed" ? "#fee2e2" : "#fff7d6";
      const label = rs === "failed" ? "✗ Email gagal" : "⏳ Email pending";
      return <span style={{ ...S.badge, background: bg }}>{label}</span>;
    }
    if (d.zone_status === "active")
      return (
        <button onClick={() => callSync(d.id)} disabled={busyId === d.id} style={{ ...S.badge, background: "#fff", cursor: busyId === d.id ? "wait" : "pointer" }}>
          {busyId === d.id ? "Syncing..." : "▶ Activate"}
        </button>
      );
    return <span style={{ ...S.badge, background: "#FF6B35", color: "#fff" }}>Pending NS</span>;
  };

  const resendVerified = (d: Domain) => d.resend_status === "verified";

  return (
    <div>
      <div style={S.addRow}>
        <input
          autoComplete="new-password"
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          style={S.input}
          placeholder="domainkamu.com"
          data-testid="custom-domain-input"
        />
        <button onClick={handleAdd} disabled={submitting || !newDomain.trim()} style={S.addBtn}>
          {submitting ? "Adding..." : "+ Add Domain"}
        </button>
      </div>
      {error && <p style={S.err}>{error}</p>}

      {domains.some(d => d.domain_type !== "email_only") && (
        <div style={{ ...S.addRow, marginTop: 10, opacity: submitting ? 0.6 : 1 }}>
          <input
            autoComplete="new-password"
            value={emailSubdomain}
            onChange={(e) => setEmailSubdomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddEmailSubdomain()}
            style={{ ...S.input, borderColor: "#A78BFA" }}
            placeholder="email.namadomain.com"
            data-testid="email-subdomain-input"
          />
          <button onClick={handleAddEmailSubdomain} disabled={submitting || !emailSubdomain.trim()} style={{ ...S.addBtn, background: "#A78BFA", color: "#fff" }}>
            {submitting ? "Adding..." : "📧 Email Subdomain"}
          </button>
        </div>
      )}

      <div style={S.listHead}>
        <div style={S.listTxt}>Your Domains</div>
        <div style={S.line} />
      </div>

      <p style={{ fontSize: 12, color: "#666", margin: "0 0 10px" }}>
        Terima email: <b>unlimited</b> (Cloudflare gratis). Kirim email (Resend):{" "}
        <b>{resendDomains.filter((r: any) => !["x.door.id", "door.id"].includes(r.domain)).length}/3</b> domain terpakai.
      </p>

      {loading ? (
        <div style={S.empty}>Loading...</div>
      ) : allDomains.length === 0 ? (
        <div style={S.empty}>Belum ada domain. Tambah yang pertama di atas.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {allDomains.map((d) => (
            <div key={d.id} style={S.card}>
              <div style={S.cardTop}>
                <div style={S.left}>
                  <Globe size={20} strokeWidth={2.5} />
                  <span style={S.domain}>{d.domain}</span>
                  {statusBadge(d)}
                  {d.source === "resend" && (
                    <span style={{ ...S.badge, background: "#A78BFA", color: "#fff", fontSize: 10 }}>Resend</span>
                  )}
                </div>
                <div style={S.actions}>
                  {d.source === "db" && !d.is_verified && d.zone_status !== "active" && (
                    <button onClick={() => callSync(d.id)} disabled={busyId === d.id} style={S.btn}>
                      {busyId === d.id ? "..." : "Recheck"}
                    </button>
                  )}
                  {d.source === "db" && d.zone_status === "active" && !resendVerified(d) && (
                    <button onClick={() => callSync(d.id)} disabled={busyId === d.id} style={{ ...S.btn, background: "#BEEE11" }}>
                      {busyId === d.id ? "Syncing..." : "Sync Email"}
                    </button>
                  )}
                  {d.source === "db" && d.resend_status === "failed" && (
                    <button onClick={() => handleDeleteResend(d.id)} disabled={busyId === d.id} style={{ ...S.btn, background: "#fee2e2", color: "#991b1b" }}>
                      {busyId === d.id ? "..." : "Hapus dari Resend"}
                    </button>
                  )}
                  {d.source === "resend" && (
                    <button onClick={() => deleteResendDomain(d.id, d.domain)} disabled={busyId === d.id} style={{ ...S.btn, background: "#fee2e2", color: "#991b1b" }}>
                      {busyId === d.id ? "..." : "Hapus"}
                    </button>
                  )}
                  {d.source === "db" && (
                    <button onClick={() => handleDelete(d.id, d.domain)} style={{ ...S.btn, color: "#dc2626" }}>Delete</button>
                  )}
                  {d.source === "db" && (
                    <button aria-label="Tampilkan instruksi" onClick={() => setExpandedId(expandedId === d.id ? null : d.id)} style={S.iconBtn}>
                      <ChevronDown size={16} strokeWidth={2.5} className={expandedId === d.id ? "rotate-180" : ""} />
                    </button>
                  )}
                </div>
              </div>

              {d.source === "db" && expandedId === d.id && (
                <div style={S.expandBox}>
                  <p style={S.expTitle}>1. Salin nameserver ini ke registrar kamu:</p>
                  {(d.nameservers?.length ? d.nameservers : []).map((ns) => (
                    <button key={ns} onClick={() => copyNs(ns)} style={S.nsRow}>
                      <code style={S.nsCode}>{ns}</code>
                      <span style={S.copyLbl}>{copiedNs === ns ? "Copied!" : "Copy"}</span>
                    </button>
                  ))}
                  {!d.nameservers?.length && <p style={S.mutedItalic}>Menunggu pembuatan zone...</p>}
                  <p style={S.expNote}>
                    2. Tunggu propagasi (5 menit–48 jam).<br />
                    3. Klik <b>Activate</b> — worker + email routing otomatis disiapkan.
                  </p>
                  {d.is_verified && d.resend_status === "failed" && (
                    <p style={{ ...S.rowErr, marginTop: 12 }}>
                      ⚠️ Verifikasi email gagal. Penyebab umum: domain utama sudah punya MX lain (mis. Zoho/Google Workspace) sehingga Resend tidak bisa memasang MX-nya.
                      Solusi: gunakan <b>subdomain</b> untuk email, misal <code>email.{d.parent_domain || d.domain}</code> atau <code>mail.{d.parent_domain || d.domain}</code> — tambah sebagai domain baru, lalu buat alamat di sana.
                    </p>
                  )}
                </div>
              )}

              {d.source === "resend" && (
                <p style={{ ...S.rowErr, marginTop: 8, fontSize: 12 }}>
                  Domain ini hanya terdaftar di Resend (tidak di Door.id). Hapus untuk membebaskan slot domain plan kamu.
                </p>
              )}

              {rowErrors[d.id] && <p style={S.rowErr}>{rowErrors[d.id]}</p>}
              {d.source === "db" && d.provision_error && <p style={S.rowErr}>{d.provision_error}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  addRow: { display: "flex", gap: 8 },
  input: {
    flex: 1,
    padding: "11px 14px",
    fontSize: "14px",
    fontWeight: 600,
    fontFamily: "'DM Mono', monospace",
    border: "2.5px solid #000",
    borderRadius: 6,
    outline: "none",
    boxShadow: "3px 3px 0 #000",
  },
  addBtn: {
    padding: "11px 16px",
    fontSize: "13px",
    fontWeight: 800,
    border: "2.5px solid #000",
    borderRadius: 6,
    background: "#d4ff00",
    boxShadow: "3px 3px 0 #000",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  err: { color: "#dc2626", fontSize: 13, marginTop: 10, fontWeight: 700 },
  listHead: { display: "flex", alignItems: "center", gap: 10, margin: "26px 0 12px" },
  listTxt: {
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase" as const,
    letterSpacing: ".06em",
    background: "#000",
    color: "#fff",
    padding: "4px 10px",
    borderRadius: 3,
  },
  line: { flex: 1, height: 3, background: "repeating-linear-gradient(90deg,#000,#000 6px,transparent 6px,transparent 11px)" },
  empty: { padding: "36px 16px", textAlign: "center" as const, color: "#888", fontSize: 13.5, fontWeight: 600 },
  card: { background: "#fff", border: "2.5px solid #000", borderRadius: 6, padding: 15, boxShadow: "5px 5px 0 #000" },
  cardTop: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  left: { display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" as const },
  domain: { fontFamily: "'DM Mono', monospace", fontSize: 14.5, fontWeight: 700 },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 9px",
    borderRadius: 3,
    fontSize: 10.5,
    fontFamily: "'DM Mono', monospace",
    fontWeight: 800,
    textTransform: "uppercase" as const,
    border: "2.5px solid #000",
  },
  actions: { display: "flex", gap: 7, alignItems: "center" },
  btn: {
    padding: "7px 12px",
    fontSize: 12,
    fontWeight: 800,
    border: "2.5px solid #000",
    borderRadius: 5,
    background: "#fff",
    boxShadow: "2.5px 2.5px 0 #000",
    cursor: "pointer",
  },
  iconBtn: {
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2.5px solid #000",
    borderRadius: 5,
    background: "#fff",
    boxShadow: "2.5px 2.5px 0 #000",
    cursor: "pointer",
  },
  expandBox: { marginTop: 12, borderTop: "2.5px dashed #000", paddingTop: 12 },
  expTitle: { fontSize: 12.5, fontWeight: 800, marginBottom: 8 },
  nsRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    background: "#f5f0e8",
    border: "2.5px solid #000",
    borderRadius: 5,
    padding: "9px 12px",
    marginBottom: 6,
    cursor: "pointer",
  },
  nsCode: { fontFamily: "'DM Mono', monospace", fontSize: 12.5, fontWeight: 700 },
  copyLbl: { fontSize: 10.5, fontWeight: 800, textTransform: "uppercase" as const, fontFamily: "'DM Mono', monospace" },
  mutedItalic: { fontStyle: "italic", color: "#888", fontSize: 12.5 },
  expNote: { fontSize: 12.5, color: "#444", marginTop: 8, lineHeight: 1.55 },
  rowErr: { marginTop: 10, background: "#fee2e2", border: "2px solid #dc2626", borderRadius: 4, padding: "8px 10px", fontSize: 12.5, color: "#991b1b", fontWeight: 600 },
};
