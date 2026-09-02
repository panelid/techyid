"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pkBusy, setPkBusy] = useState(false);
  const [pkError, setPkError] = useState("");
  const [pkDone, setPkDone] = useState(false);

  // [4] Redirect authenticated users away from /register
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

  // [Biometric] Register a passkey for the newly-created account
  const handlePasskeyRegister = async () => {
    setPkBusy(true);
    setPkError("");
    setPkDone(false);
    try {
      if (!navigator.credentials || !window.PublicKeyCredential) {
        setPkError("Perangkat tidak mendukung biometrik (WebAuthn)");
        return;
      }

      const optRes = await fetch("/api/auth/passkey/register/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!optRes.ok) {
        const d = await optRes.json();
        setPkError(d.error || "Gagal memulai pendaftaran biometrik");
        return;
      }
      const { options } = await optRes.json();

      const cred = await navigator.credentials.create({
        publicKey: {
          challenge: b64ToUint8(options.challenge),
          rp: { id: options.rp.id, name: options.rp.name },
          user: {
            id: b64ToUint8(options.user.id),
            name: options.user.name,
            displayName: options.user.displayName,
          },
          pubKeyCredParams: options.pubKeyCredParams,
          timeout: options.timeout,
          attestation: options.attestation,
          excludeCredentials: (options.excludeCredentials || []).map((c: any) => ({
            type: c.type,
            id: b64ToUint8(c.id),
          })),
          authenticatorSelection: options.authenticatorSelection,
        },
      });

      if (!cred) {
        setPkError("Pendaftaran biometrik dibatalkan");
        return;
      }

      const att = cred as any;
      const payload = {
        id: att.id,
        rawId: arrayBufToB64(att.rawId),
        type: att.type,
        response: {
          clientDataJSON: arrayBufToB64(att.response.clientDataJSON),
          attestationObject: arrayBufToB64(att.response.attestationObject),
        },
      };

      const verRes = await fetch("/api/auth/passkey/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const verData = await verRes.json();
      if (!verRes.ok) {
        setPkError(verData.error || "Gagal verifikasi biometrik");
        return;
      }
      setPkDone(true);
    } catch (e: any) {
      setPkError(e?.message || "Gagal mendaftarkan biometrik");
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, username }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed");
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
          <h1 style={styles.title}>Register to Door.id</h1>
          {error && <div style={styles.error}>{error}</div>}
          {success ? (
            <div style={styles.successBox}>
              <p style={{ fontWeight: 700, marginBottom: 10 }}>🎉 Akun Berhasil Dibuat!</p>
              <p style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>Sesi Anda sudah aktif. Anda bisa kembali ke halaman utama atau buka dashboard.</p>
              {pkDone && (
                <p style={{ fontWeight: 700, color: "#10b981", marginBottom: 16 }}>✅ Biometrik berhasil didaftarkan!</p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
                <button
                  onClick={handlePasskeyRegister}
                  disabled={pkBusy || pkDone}
                  style={{ ...styles.btnPrimary, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  <span style={{ fontSize: 18 }}>🔐</span>
                  {pkBusy ? 'Memproses...' : (pkDone ? '✅ Biometrik Terdaftar' : 'Daftarkan Biometrik (Opsional)')}
                </button>
                {pkError && <div style={styles.error}>{pkError}</div>}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button style={styles.btnPrimary} onClick={() => router.push("/")}>Ke Beranda</button>
                <button style={styles.btnSecondary} onClick={() => router.push("/dashboard")}>Buka Dashboard</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegister} style={styles.form}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Username</label>
                <input
                  style={styles.input}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  required
                />
              </div>
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
                  placeholder="Min 8 karakter (huruf + angka)"
                  required
                />
                {password && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: (password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password)) ? '#10b981' : '#e11d48', marginTop: 3 }}>
                    {(password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password)) ? '✅ Kekuatan password cukup' : '⚠️ Min 8 karakter, harus ada huruf dan angka'}
                  </div>
                )}
              </div>
              <button type="submit" style={styles.btnPrimary} disabled={submitting}>
                {submitting ? 'Loading...' : 'Register'}
              </button>
              <p style={styles.footerText}>
                Sudah punya akun? <a href="/login" style={styles.link}>Login di sini</a>
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
