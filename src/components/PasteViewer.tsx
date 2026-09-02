"use client";
import { useState, useEffect } from "react";

export default function PasteViewer({ slug, content, hasPassword }: {
  slug: string;
  content: string;
  hasPassword: boolean;
}) {
  const [verified, setVerified] = useState(!hasPassword);
  const [revealedContent, setRevealedContent] = useState(hasPassword ? "" : content);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Increment view count when paste is opened/unlocked
  useEffect(() => {
    if (verified) {
      fetch("/api/paste/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      }).catch(() => {});
    }
  }, [verified, slug]);

  const verifyPassword = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/paste/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, password }),
      });
      const data = await res.json();
      if (data.success) {
        setRevealedContent(data.content || "");
        setVerified(true);
      } else {
        setError(data.error || "Password salah");
      }
    } catch {
      setError("Gagal memverifikasi password");
    } finally {
      setLoading(false);
    }
  };

  if (!verified) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.lockIcon}>🔒</div>
          <h2 style={styles.title}>Paste Terenkripsi</h2>
          <p style={styles.subtitle}>Paste ini dilindungi kata sandi.</p>
          <div style={styles.formGroup}>
            <input
              type="password"
              placeholder="Masukkan kata sandi..."
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && verifyPassword()}
              style={styles.input}
              data-testid="paste-password-input"
            />
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button
            onClick={verifyPassword}
            disabled={loading || !password}
            style={{ ...styles.button, opacity: loading || !password ? 0.6 : 1 }}
            data-testid="paste-password-submit"
          >
            {loading ? "Memverifikasi..." : "Buka Paste"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.badge}>📄 PASTE</span>
          <span style={styles.slug}>techy.id/{slug}</span>
        </div>
        <pre style={styles.content} data-testid="paste-content">{revealedContent}</pre>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    background: "#f5f0e8",
    backgroundImage: "radial-gradient(#00000012 1px, transparent 1px)",
    backgroundSize: "16px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    fontFamily: "'Space Grotesk', sans-serif",
  },
  card: {
    background: "#fff",
    border: "3px solid #000",
    borderRadius: "8px",
    boxShadow: "6px 6px 0 #000",
    padding: "32px",
    maxWidth: "640px",
    width: "100%",
  },
  lockIcon: { fontSize: "48px", textAlign: "center" as const, marginBottom: "12px" },
  title: { fontSize: "24px", fontWeight: 800, textAlign: "center" as const, margin: "0 0 8px" },
  subtitle: { fontSize: "14px", color: "#666", textAlign: "center" as const, margin: "0 0 24px" },
  formGroup: { marginBottom: "16px" },
  input: {
    width: "100%",
    padding: "12px 16px",
    fontSize: "14px",
    border: "2.5px solid #000",
    borderRadius: "6px",
    outline: "none",
    fontFamily: "'DM Mono', monospace",
    boxSizing: "border-box" as const,
  },
  error: { color: "#dc2626", fontSize: "13px", textAlign: "center" as const, margin: "0 0 12px" },
  button: {
    width: "100%",
    padding: "14px",
    fontSize: "14px",
    fontWeight: 700,
    border: "2.5px solid #000",
    borderRadius: "6px",
    background: "#d4ff00",
    boxShadow: "4px 4px 0 #000",
    cursor: "pointer",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "20px",
  },
  badge: {
    fontFamily: "'DM Mono', monospace",
    fontSize: "11px",
    fontWeight: 700,
    background: "#000",
    color: "#d4ff00",
    padding: "4px 10px",
    borderRadius: "20px",
  },
  slug: {
    fontFamily: "'DM Mono', monospace",
    fontSize: "13px",
    fontWeight: 700,
    color: "#4F46E5",
  },
  content: {
    background: "#f5f0e8",
    border: "2.5px solid #000",
    borderRadius: "6px",
    padding: "16px",
    fontSize: "13px",
    fontFamily: "'DM Mono', monospace",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
    margin: 0,
  },
};
