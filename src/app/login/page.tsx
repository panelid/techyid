"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pkBusy, setPkBusy] = useState(false);
  const [pkError, setPkError] = useState("");

  // [4] Redirect authenticated users away from /login
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => {
        if (r.ok) {
          router.replace("/dashboard");
          return;
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  // [Biometric] Passkey login flow
  const handlePasskeyLogin = async () => {
    setPkBusy(true);
    setPkError("");
    try {
      // 1. Request authentication options (no email → any passkey for this RP)
      const optRes = await fetch("/api/auth/passkey/login/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!optRes.ok) {
        const d = await optRes.json();
        setPkError(d.error || "Gagal memulai login biometrik");
        return;
      }
      const { options } = await optRes.json();

      // 2. Ask the browser to authenticate with the passkey
      if (!navigator.credentials || !window.PublicKeyCredential) {
        setPkError("Browser/perangkat tidak mendukung biometrik (WebAuthn)");
        return;
      }
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: b64ToUint8(options.challenge),
          rpId: options.rpID || options.rpId || window.location.hostname,
          allowCredentials: (options.allowCredentials || []).map((c: any) => ({
            type: c.type,
            id: b64ToUint8(c.id),
          })),
          timeout: options.timeout,
          userVerification: options.userVerification || "preferred",
        },
      });

      if (!assertion) {
        setPkError("Login biometrik dibatalkan");
        return;
      }

      // 3. Serialize the assertion
      const att = assertion as any;
      const payload = {
        id: att.id,
        rawId: arrayBufToB64(att.rawId),
        type: att.type,
        response: {
          authenticatorData: arrayBufToB64(att.response.authenticatorData),
          clientDataJSON: arrayBufToB64(att.response.clientDataJSON),
          signature: arrayBufToB64(att.response.signature),
          userHandle: att.response.userHandle ? arrayBufToB64(att.response.userHandle) : null,
        },
      };

      // 4. Verify on server → session created
      const verRes = await fetch("/api/auth/passkey/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const verData = await verRes.json();
      if (!verRes.ok) {
        setPkError(verData.error || "Verifikasi biometrik gagal");
        return;
      }
      router.push("/dashboard");
    } catch (e: any) {
      setPkError(e?.message || "Gagal login biometrik");
    } finally {
      setPkBusy(false);
    }
  };

  function b64ToUint8(b64url: string): Uint8Array {
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - b64.length % 4) % 4);
    const bin = atob(padded);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

  function arrayBufToB64(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf);
    let str = "";
    for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  if (checking) {
    return (
      <div style={styles.body}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
          <p style={{ fontSize: 14, color: "#888", fontWeight: 600 }}>Memeriksa sesi...</p>
        </div>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.body}>
      <nav style={styles.nav}>
        <div style={styles.logo} onClick={() => router.push("/")}>⚡ door<span>.id</span></div>
      </nav>
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Login to Door.id</h1>
          {error && <div style={styles.error}>{error}</div>}
          {success ? (
            <div style={styles.successBox}>
              <p style={{ fontWeight: 700, marginBottom: 10 }}>🎉 Login Berhasil!</p>
              <p style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>Sesi Anda sudah aktif. Anda bisa kembali ke halaman utama atau buka dashboard.</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button style={styles.btnPrimary} onClick={() => router.push("/")}>Ke Beranda</button>
                <button style={styles.btnSecondary} onClick={() => router.push("/dashboard")}>Buka Dashboard</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleLogin} style={styles.form}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Email</label>
                <input
                  style={styles.input}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  required
                />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Password</label>
                <input
                  style={styles.input}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <button type="submit" style={styles.btnPrimary} disabled={submitting}>
                {submitting ? 'Loading...' : 'Login'}
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
                <div style={{ flex: 1, height: 2, background: "#e5e5e5" }} />
                <span style={{ fontSize: 11, color: "#999", fontWeight: 700 }}>ATAU</span>
                <div style={{ flex: 1, height: 2, background: "#e5e5e5" }} />
              </div>
              <button
                type="button"
                onClick={handlePasskeyLogin}
                disabled={pkBusy}
                style={{
                  ...styles.btnPrimary,
                  background: "#fff",
                  boxShadow: "3px 3px 0 #000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 18 }}>🔐</span>
                {pkBusy ? 'Memproses...' : 'Masuk dengan Biometrik'}
              </button>
              {pkError && <div style={styles.error}>{pkError}</div>}
              <p style={styles.footerText}>
                Belum punya akun? <a href="/register" style={styles.link}>Register di sini</a>
              </p>
            </form>
          )}
        </div>
      </div>
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
    color: "#0a0a0a",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    padding: "16px 24px",
    background: "#fff",
    borderBottom: "4px solid #000",
  },
  logo: {
    fontSize: "20px",
    fontWeight: 800,
    letterSpacing: "-0.03em",
    cursor: "pointer",
  },
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "60px 16px",
  },
  card: {
    background: "#fff",
    border: "3px solid #000",
    borderRadius: "8px",
    padding: "32px",
    boxShadow: "6px 6px 0 #000",
    width: "100%",
    maxWidth: "420px",
  },
  title: {
    fontSize: "24px",
    fontWeight: 800,
    marginBottom: "20px",
    letterSpacing: "-0.02em",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  input: {
    padding: "12px",
    border: "2.5px solid #000",
    borderRadius: "5px",
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: "14px",
    outline: "none",
    fontWeight: 500,
  },
  btnPrimary: {
    padding: "12px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    border: "2.5px solid #000",
    borderRadius: "5px",
    background: "#d4ff00",
    boxShadow: "3px 3px 0 #000",
    transition: "transform 0.08s, box-shadow 0.08s",
  },
  btnSecondary: {
    padding: "12px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    border: "2.5px solid #000",
    borderRadius: "5px",
    background: "#fff",
    boxShadow: "3px 3px 0 #000",
  },
  error: {
    padding: "10px",
    background: "#ffe0dc",
    border: "2px solid #000",
    borderRadius: "4px",
    color: "#c0392b",
    fontSize: "13px",
    fontWeight: 700,
    marginBottom: "16px",
  },
  successBox: {
    textAlign: "center" as const,
    padding: "20px 0",
  },
  footerText: {
    fontSize: "13px",
    textAlign: "center" as const,
    color: "#555",
    marginTop: "10px",
    fontWeight: 500,
  },
  link: {
    color: "#4F46E5",
    fontWeight: 700,
    textDecoration: "underline",
  },
};
