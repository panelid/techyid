"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Pencil, QrCode, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import BottomNav from "./BottomNav";

export default function DashboardClient({ user, isAdmin }: { user: any; isAdmin?: boolean }) {
  const router = useRouter();
  const [slugs, setSlugs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [qrModalUrl, setQrModalUrl] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [domainCount, setDomainCount] = useState(0);
  const [emailAliases, setEmailAliases] = useState<any[]>([]);

  const fetchSlugs = async () => {
    try {
      const res = await fetch("/api/slugs/create", { cache: "no-store" });
      const data = await res.json();
      if (data.slugs) {
        setSlugs(data.slugs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const [dRes, aRes] = await Promise.all([
        fetch("/api/domains", { cache: "no-store" }),
        fetch("/api/email-aliases", { cache: "no-store" }),
      ]);
      if (dRes.ok) {
        const d = await dRes.json();
        setDomainCount((d.domains || []).length);
      }
      if (aRes.ok) {
        const a = await aRes.json();
        setEmailAliases(a.aliases || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSlugs();
    fetchStats();
  }, []);

  const handleDelete = async (id: any, slugStr: string) => {
    if (!confirm(`Hapus link techy.id/${slugStr}?`)) return;
    try {
      const res = await fetch(`/api/slugs/${id}`, { method: "DELETE" });
      if (res.ok) {
        // Re-fetch to ensure DOM stays in sync with DB
        const listRes = await fetch("/api/slugs/create");
        if (listRes.ok) {
          const d = await listRes.json();
          setSlugs(d.slugs || []);
        }
      } else {
        alert("Gagal menghapus link");
      }
    } catch (e) { alert("Gagal menghapus link"); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;

    let payloadData = editItem.data;
    const res = await fetch(`/api/slugs/${editItem.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: payloadData }),
    });

    if (res.ok) {
      await fetchSlugs();
      setEditItem(null);
    } else {
      alert("Gagal update link");
    }
  };

  // Stats calculation
  const totalLinks = slugs.length;
  const totalClicks = slugs.reduce((acc, s) => acc + (s.click_count || 0), 0);
  const typeCounts = slugs.reduce((acc: any, s) => {
    acc[s.type] = (acc[s.type] || 0) + 1;
    return acc;
  }, {});
  const topLinks = [...slugs].sort((a, b) => (b.click_count || 0) - (a.click_count || 0)).slice(0, 3);

  const filteredSlugs = slugs.filter(s => filter === "all" || s.type === filter);

  return (
    <div style={styles.body}>
      <div className="header" style={styles.header}>
        <div className="logo" style={styles.logo} onClick={() => router.push("/")}>techy<span>.id</span></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="header-btn" style={styles.headerBtn} onClick={() => router.push("/")}>+ New Link</button>
          <button className="header-btn" style={{ ...styles.headerBtn, background: '#fff' }} onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/'); }}>Logout</button>
        </div>
      </div>

      <div className="stats" style={styles.stats}>
        <div className="stat" style={styles.statCard}>
          <div className="stat-label" style={styles.statLabel}>Total Links</div>
          <div className="stat-val" style={styles.statVal}>{totalLinks}</div>
          <div className="stat-sub" style={styles.statSub}><b>Aktif</b> di akun Anda</div>
        </div>
        <div className="stat" style={styles.statCard}>
          <div className="stat-label" style={styles.statLabel}>Views</div>
          <div className="stat-val" style={styles.statVal}>{totalClicks}</div>
          <div className="stat-sub" style={styles.statSub}><b>Total</b> klik &amp; buka</div>
        </div>
        <div className="stat" style={styles.statCard}>
          <div className="stat-label" style={styles.statLabel}>Domains</div>
          <div className="stat-val" style={styles.statVal}>{domainCount}</div>
          <div className="stat-sub" style={styles.statSub}>Custom domains</div>
        </div>
        <div className="stat" style={styles.statCard}>
          <div className="stat-label" style={styles.statLabel}>Email Aliases</div>
          <div className="stat-val" style={styles.statVal}>{emailAliases.length}</div>
          <div className="stat-sub" style={styles.statSub}>Active</div>
        </div>
      </div>

      {/* Top links */}
      {topLinks.length > 0 && topLinks[0].click_count > 0 && (
        <div style={styles.topWrap}>
          <div style={styles.topHeading}>🔥 Link Terpopuler</div>
          {topLinks.map((l) => (
            <div key={l.id} style={styles.topRow}>
              <span style={styles.topSlug}>techy.id/{l.slug}</span>
              <span style={styles.topClicks}><b>{l.click_count || 0}</b> views</span>
            </div>
          ))}
        </div>
      )}

      <div className="tabs-wrap" style={styles.tabsWrap}>
        <div className="tabs" style={styles.tabs}>
          <div className={`tab ${filter==='all'?'on':''}`} style={{...styles.tab, ...(filter==='all'?styles.tabOn:{})}} onClick={() => setFilter('all')}>
            All <span className="count" style={styles.count}>{slugs.length}</span>
          </div>
          <div className={`tab ${filter==='url'?'on':''}`} style={{...styles.tab, ...(filter==='url'?styles.tabOn:{})}} onClick={() => setFilter('url')}>
            URL <span className="count" style={styles.count}>{slugs.filter(s => s.type === 'url').length}</span>
          </div>
          <div className={`tab ${filter==='wa'?'on':''}`} style={{...styles.tab, ...(filter==='wa'?styles.tabOn:{})}} onClick={() => setFilter('wa')}>
            WhatsApp <span className="count" style={styles.count}>{slugs.filter(s => s.type === 'wa').length}</span>
          </div>
          <div className={`tab ${filter==='bio'?'on':''}`} style={{...styles.tab, ...(filter==='bio'?styles.tabOn:{})}} onClick={() => setFilter('bio')}>
            Bio <span className="count" style={styles.count}>{slugs.filter(s => s.type === 'bio').length}</span>
          </div>
          <div className={`tab ${filter==='paste'?'on':''}`} style={{...styles.tab, ...(filter==='paste'?styles.tabOn:{})}} onClick={() => setFilter('paste')}>
            Paste <span className="count" style={styles.count}>{slugs.filter(s => s.type === 'paste').length}</span>
          </div>
        </div>
      </div>

      <div className="list-heading" style={styles.listHeading}>
        <div className="txt" style={styles.listTxt}>Link Anda ({user.email})</div>
        <div className="line" style={styles.listLine}></div>
      </div>

      {loading ? (
        <div style={styles.empty}>Memuat data...</div>
      ) : filteredSlugs.length === 0 ? (
        <div style={{ ...styles.empty, textAlign: 'center', padding: '40px 16px' }}>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Belum ada link di kategori ini.</p>
          <button style={styles.headerBtn} onClick={() => router.push('/')}>+ Buat Link Pertama</button>
        </div>
      ) : (
        <div className="cards" style={styles.cards}>
          {filteredSlugs.map((s) => {
            const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}/${s.slug}` : `https://techy.id/${s.slug}`;
            let dest = s.data.url || s.data.phone || (s.data.links ? `${s.data.links.length} links` : '') || (s.data.content ? 'Protected paste' : '');
            return (
              <div key={s.id} className="card" style={styles.card} data-type={s.type}>
                <div className="card-top" style={styles.cardTop}>
                  <a className="card-slug" style={{...styles.cardSlug, color: "inherit", textDecoration: "underline"}} href={fullUrl} target="_blank" rel="noopener noreferrer">{new URL(fullUrl).host}/{s.slug}</a>
                  <span className={`badge ${s.type}`} style={{...styles.badge, ...styles[s.type as keyof typeof styles]}}>{s.type.toUpperCase()}</span>
                </div>
                <div className="card-dest" style={styles.cardDest}>{dest}</div>
                <div className="card-bottom" style={styles.cardBottom}>
                  <div className="card-meta" style={styles.cardMeta}><b>{s.click_count || 0}</b> clicks · {new Date(s.created_at).toLocaleDateString()}</div>
                  <div className="actions" style={styles.actions}>
                    <button className="icon-btn qr" style={styles.iconBtn} title="QR Code" onClick={() => setQrModalUrl(fullUrl)}>
                      <QrCode size={16} strokeWidth={2.5} />
                    </button>
                    <button className="icon-btn edit" style={styles.iconBtn} title="Edit" onClick={() => setEditItem(s)}>
                      <Pencil size={16} strokeWidth={2.5} />
                    </button>
                    <button className="icon-btn del" style={styles.iconBtn} title="Hapus" onClick={() => handleDelete(s.id, s.slug)}>
                      <Trash2 size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="section-title" style={styles.sectionTitle}>✉️ Email Aliases</div>
      {emailAliases.length > 0 ? (
        <div className="email-card" style={styles.emailCard}>
          {emailAliases.map((a: any) => (
            <div key={a.id} className="email-row" style={{ ...styles.emailRow, borderBottom: `1px solid #eee`, ...(emailAliases.indexOf(a) === emailAliases.length - 1 ? { borderBottom: "none" } : {}) }}>
              <div className="dot" style={styles.dot}></div>
              {a.local_part}@{a.domain} <span style={{ color: "#bbb" }}>→</span> <span style={{ color: "#888" }}>{user.email}</span>
              {a.is_default ? <span style={{ fontSize: 9, fontWeight: 800, background: "#d4ff00", border: "1.5px solid #000", padding: "1px 5px", marginLeft: 4 }}>DEFAULT</span> : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="email-card" style={styles.emailCard}>
          <div className="email-row" style={styles.emailRow}><div className="dot" style={styles.dot}></div><span style={{ color: "#999" }}>Belum ada alias. Tambah di halaman Email → Pengirim.</span></div>
        </div>
      )}

      {/* QR Modal */}
      {qrModalUrl && (
        <div style={styles.modalOverlay} onClick={() => setQrModalUrl(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={{fontWeight:800, marginBottom:16}}>QR Code</h3>
            <div style={{background:'#fff', padding:16, border:'2.5px solid #000', display:'inline-block', marginBottom:16}}>
              <QRCodeSVG value={qrModalUrl} size={180} />
            </div>
            <p style={{fontFamily:'monospace', fontSize:12, marginBottom:16, wordBreak:'break-all'}}>{qrModalUrl}</p>
            <button style={styles.headerBtn} onClick={() => setQrModalUrl(null)}>Tutup</button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editItem && (
        <div style={styles.modalOverlay} onClick={() => setEditItem(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={{fontWeight:800, marginBottom:16}}>Edit Link: {editItem.slug}</h3>
            <form autoComplete="new-password" onSubmit={handleUpdate} style={{display:'flex', flexDirection:'column', gap:12, textAlign:'left'}}>
              {editItem.type === 'url' && (
                <div>
                  <label style={{fontSize:11, fontWeight:700}}>Destination URL</label>
                  <input autoComplete="new-password"
                    style={styles.inputModal}
                    value={editItem.data.url || ''}
                    onChange={(e) => setEditItem({...editItem, data: {...editItem.data, url: e.target.value}})}
                    required
                  />
                </div>
              )}
              {editItem.type === 'wa' && (
                <>
                  <div>
                    <label style={{fontSize:11, fontWeight:700}}>WhatsApp Number</label>
                    <input autoComplete="new-password"
                      style={styles.inputModal}
                      value={editItem.data.phone || ''}
                      onChange={(e) => setEditItem({...editItem, data: {...editItem.data, phone: e.target.value}})}
                      required
                    />
                  </div>
                  <div>
                    <label style={{fontSize:11, fontWeight:700}}>Default Message</label>
                    <input autoComplete="new-password"
                      style={styles.inputModal}
                      value={editItem.data.message || ''}
                      onChange={(e) => setEditItem({...editItem, data: {...editItem.data, message: e.target.value}})}
                    />
                  </div>
                </>
              )}
              {editItem.type === 'paste' && (
                <div>
                  <label style={{fontSize:11, fontWeight:700}}>Paste Content</label>
                  <textarea autoComplete="new-password"
                    style={{...styles.inputModal, height:100}}
                    value={editItem.data.content || ''}
                    onChange={(e) => setEditItem({...editItem, data: {...editItem.data, content: e.target.value}})}
                    required
                  />
                </div>
              )}
              {editItem.type === 'bio' && (
                <div>
                  <label style={{fontSize:11, fontWeight:700}}>Bio Links (JSON)</label>
                  <textarea autoComplete="new-password"
                    style={{...styles.inputModal, height:100}}
                    value={JSON.stringify(editItem.data.links || [], null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        setEditItem({...editItem, data: {...editItem.data, links: parsed}});
                      } catch {}
                    }}
                  />
                </div>
              )}
              <div style={{display:'flex', gap:10, marginTop:10}}>
                <button type="submit" style={styles.headerBtn}>Simpan</button>
                <button type="button" style={{...styles.headerBtn, background:'#fff'}} onClick={() => setEditItem(null)}>Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BottomNav active="stat" isAdmin={isAdmin} />
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  body: {
    background: "#f5f0e8",
    backgroundImage: "radial-gradient(#00000012 1px, transparent 1px)",
    backgroundSize: "16px 16px",
    fontFamily: "'Space Grotesk', sans-serif",
    minHeight: "100vh",
    paddingBottom: "80px",
    color: "#0a0a0a",
    maxWidth: 900,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap" as const,
    gap: "8px",
    padding: "12px 14px",
    background: "#fff",
    borderBottom: "4px solid #000",
    position: "sticky" as const,
    top: 0,
    zIndex: 220,
  },
  breakdownWrap: {
    display: "flex",
    gap: "8px",
    padding: "0 16px 14px",
    flexWrap: "wrap" as const,
  },
  breakdownItem: {
    flex: "1 1 auto",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: "#fff",
    border: "2.5px solid #000",
    borderRadius: "5px",
    padding: "8px 12px",
    boxShadow: "2.5px 2.5px 0 #000",
    fontSize: "12px",
    fontWeight: 700,
  },
  breakdownDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    border: "1.5px solid #000",
  },
  breakdownLabel: {
    color: "#555",
  },
  breakdownCount: {
    marginLeft: "auto",
    fontFamily: "'DM Mono', monospace",
    fontWeight: 800,
  },
  topWrap: {
    margin: "0 16px 14px",
    background: "#fff",
    border: "2.5px solid #000",
    borderRadius: "6px",
    boxShadow: "4px 4px 0 #000",
    padding: "12px 14px",
  },
  topHeading: {
    fontSize: "13px",
    fontWeight: 800,
    marginBottom: "8px",
    textTransform: "uppercase" as const,
    letterSpacing: ".04em",
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 0",
    borderTop: "1.5px dashed #ddd",
    fontSize: "12.5px",
  },
  topSlug: {
    fontFamily: "'DM Mono', monospace",
    fontWeight: 700,
    wordBreak: "break-all" as const,
  },
  topClicks: {
    color: "#777",
    fontWeight: 700,
    whiteSpace: "nowrap" as const,
    marginLeft: 8,
  },
  logo: {
    fontSize: "20px",
    fontWeight: 800,
    letterSpacing: "-0.03em",
    cursor: "pointer",
  },
  headerBtn: {
    padding: "8px 12px",
    fontSize: "12.5px",
    fontWeight: 700,
    fontFamily: "'Space Grotesk', sans-serif",
    cursor: "pointer",
    border: "2.5px solid #000",
    borderRadius: "5px",
    background: "#d4ff00",
    boxShadow: "3px 3px 0 #000",
  },
  stats: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    padding: "16px",
  },
  statCard: {
    background: "#fff",
    border: "2.5px solid #000",
    borderRadius: "5px",
    padding: "14px",
    boxShadow: "4px 4px 0 #000",
  },
  statLabel: {
    fontSize: "10px",
    fontWeight: 700,
    color: "#777",
    textTransform: "uppercase" as const,
    letterSpacing: ".08em",
    marginBottom: "5px",
  },
  statVal: {
    fontSize: "27px",
    fontWeight: 800,
    letterSpacing: "-0.03em",
    lineHeight: 1,
  },
  statSub: {
    fontSize: "10.5px",
    color: "#888",
    marginTop: "5px",
    fontWeight: 600,
  },
  tabsWrap: {
    position: "sticky" as const,
    top: "65px",
    zIndex: 210,
    background: "#f5f0e8",
    padding: "10px 16px 12px",
    borderBottom: "4px solid #000",
  },
  tabs: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "8px",
  },
  tab: {
    flex: "1 1 auto",
    minWidth: "max-content",
    textAlign: "center" as const,
    padding: "9px 14px",
    fontSize: "12.5px",
    fontWeight: 700,
    cursor: "pointer",
    background: "#fff",
    border: "2.5px solid #000",
    borderRadius: "5px",
    fontFamily: "'Space Grotesk', sans-serif",
    whiteSpace: "nowrap" as const,
    color: "#333",
    boxShadow: "2.5px 2.5px 0 #000",
  },
  tabOn: {
    background: "#000",
    color: "#d4ff00",
    boxShadow: "2.5px 2.5px 0 #FF6B35",
  },
  count: {
    opacity: 0.5,
    fontWeight: 500,
    marginLeft: "3px",
    fontFamily: "'DM Mono', monospace",
    fontSize: "11px",
  },
  listHeading: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "18px 16px 10px",
  },
  listTxt: {
    fontSize: "13px",
    fontWeight: 800,
    textTransform: "uppercase" as const,
    letterSpacing: ".06em",
    background: "#000",
    color: "#fff",
    padding: "4px 10px",
    borderRadius: "3px",
  },
  listLine: {
    flex: 1,
    height: "3px",
    background: "repeating-linear-gradient(90deg,#000,#000 6px,transparent 6px,transparent 11px)",
  },
  cards: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
    padding: "0 16px 16px",
  },
  card: {
    background: "#fff",
    border: "2.5px solid #000",
    borderRadius: "6px",
    padding: "15px",
    boxShadow: "5px 5px 0 #000",
  },
  cardTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "9px",
  },
  cardSlug: {
    fontFamily: "'DM Mono', monospace",
    fontSize: "14.5px",
    fontWeight: 700,
    wordBreak: "break-all" as const,
  },
  cardDest: {
    fontSize: "12.5px",
    color: "#555",
    marginBottom: "13px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    fontWeight: 500,
  },
  cardBottom: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
  cardMeta: {
    fontSize: "11.5px",
    color: "#777",
    fontWeight: 700,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "4px 9px",
    borderRadius: "3px",
    fontSize: "10.5px",
    fontFamily: "'DM Mono', monospace",
    fontWeight: 800,
    textTransform: "uppercase" as const,
    border: "2.5px solid #000",
  },
  wa: { background: "#25D366", color: "#fff" },
  url: { background: "#4F46E5", color: "#fff" },
  paste: { background: "#FF6B35", color: "#fff" },
  bio: { background: "#EC4899", color: "#fff" },
  actions: {
    display: "flex",
    gap: "7px",
  },
  iconBtn: {
    width: "34px",
    height: "34px",
    border: "2.5px solid #000",
    borderRadius: "5px",
    background: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "2.5px 2.5px 0 #000",
  },
  sectionTitle: {
    fontSize: "14px",
    fontWeight: 800,
    padding: "22px 16px 10px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    textTransform: "uppercase" as const,
  },
  emailCard: {
    background: "#fff",
    border: "2.5px solid #000",
    borderRadius: "6px",
    padding: "4px 15px",
    boxShadow: "5px 5px 0 #000",
    margin: "0 16px 4px",
  },
  emailRow: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    fontSize: "12.5px",
    padding: "10px 0",
    fontWeight: 600,
  },
  dot: {
    width: "9px",
    height: "9px",
    borderRadius: "50%",
    background: "#d4ff00",
    border: "2px solid #000",
    flexShrink: 0,
  },
  empty: {
    padding: "44px 16px",
    textAlign: "center" as const,
    color: "#888",
    fontSize: "13.5px",
    fontWeight: 600,
  },
  modalOverlay: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 300,
    padding: 16,
  },
  modalCard: {
    background: "#fff",
    border: "3px solid #000",
    borderRadius: 8,
    padding: 24,
    boxShadow: "6px 6px 0 #000",
    width: "100%",
    maxWidth: "400px",
    textAlign: "center" as const,
  },
  inputModal: {
    width: "100%",
    padding: "10px",
    border: "2px solid #000",
    borderRadius: 5,
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: "13px",
    marginTop: 4,
    outline: "none",
  },
};
