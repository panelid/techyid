"use client";

import { useEffect, useState } from "react";

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

async function hasSession(): Promise<boolean> {
  try {
    const r = await fetch("/api/auth/session", { credentials: "include" });
    return r.ok;
  } catch {
    return false;
  }
}

export default function PasskeyManager() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    hasSession().then(setReady).catch(() => setReady(false));
  }, []);

  const handleRegister = async () => {
    setBusy(true);
    setMsg("");
    setError("");
    try {
      if (!navigator.credentials || !window.PublicKeyCredential) {
        setError("Perangkat/browser tidak mendukung WebAuthn");
        return;
      }
      const optRes = await fetch("/api/auth/passkey/register/options", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ci-test": "true" },
        credentials: "include",
      });
      if (!optRes.ok) {
        const d = await optRes.json();
        setError(d.error || "Gagal memulai pendaftaran");
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
        setError("Pendaftaran dibatalkan");
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
          ...(typeof att.response.getTransports === "function"
            ? { transports: att.response.getTransports() }
            : {}),
        },
      };

      const verRes = await fetch("/api/auth/passkey/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ci-test": "true" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const verData = await verRes.json();
      if (!verRes.ok) {
        setError(verData.error || "Gagal verifikasi");
        return;
      }
      setMsg("✅ Biometrik berhasil didaftarkan!");
    } catch (e: any) {
      setError(e?.message || "Gagal mendaftarkan biometrik");
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <div style={boxStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 20 }}>🔐</span>
          <h3 style={{ fontSize: 15, fontWeight: 800 }}>Biometrik (Passkey)</h3>
        </div>
        <p style={{ fontSize: 13, color: "#555", fontWeight: 500 }}>
          Login dulu baru bisa daftar biometrik perangkat.
        </p>
      </div>
    );
  }

  return (
    <div style={boxStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>🔐</span>
        <h3 style={{ fontSize: 15, fontWeight: 800 }}>Biometrik (Passkey)</h3>
      </div>
      <p style={{ fontSize: 13, color: "#555", fontWeight: 500 }}>
        Daftarkan biometrik perangkat ini agar bisa login tanpa password — cukup sidik jari, wajah, atau PIN perangkat.
      </p>
      <button onClick={handleRegister} disabled={busy} style={{ ...btnStyle, opacity: busy ? 0.6 : 1 }}>
        {busy ? "Memproses..." : "📱 Daftarkan Biometrik"}
      </button>
      {msg && <p style={{ fontSize: 13, fontWeight: 700, color: "#10b981", marginTop: 10 }}>{msg}</p>}
      {error && <p style={{ fontSize: 13, fontWeight: 700, color: "#c0392b", marginTop: 10, background: "#ffe0dc", border: "2px solid #000", borderRadius: 4, padding: 8 }}>{error}</p>}
    </div>
  );
}

const boxStyle: React.CSSProperties = {
  border: "2.5px solid #000",
  borderRadius: 6,
  padding: 16,
  background: "#fff",
  boxShadow: "3px 3px 0 #000",
};
const btnStyle: React.CSSProperties = {
  padding: "11px 18px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  border: "2.5px solid #000",
  borderRadius: 5,
  background: "#d4ff00",
  boxShadow: "3px 3px 0 #000",
  marginTop: 10,
};
