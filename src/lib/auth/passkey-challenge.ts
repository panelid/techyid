// src/lib/auth/passkey-challenge.ts
// Helper to store WebAuthn challenges in a stateless signed cookie

import { getCloudflareContext } from "@opennextjs/cloudflare";

export const CHALLENGE_COOKIE = "__door_pk_challenge";

function getSecret(): string {
  // Use same secret as session auth for simplicity
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  try {
    const { env } = getCloudflareContext();
    return (env as any).SESSION_SECRET || "dev-secret-123";
  } catch {
    return "dev-secret-123";
  }
}

async function hmacSign(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * Sign a challenge and return a string suitable for a cookie.
 */
export async function signChallenge(
  challenge: string,
  userId: string | null,
  type: "register" | "login"
): Promise<string> {
  const payload = JSON.stringify({
    c: challenge,
    u: userId,
    t: type,
    e: Date.now() + 5 * 60 * 1000, // 5 min expiry
  });
  const sig = await hmacSign(payload);
  return `${btoa(payload).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}.${sig}`;
}

/**
 * Verify a challenge from a cookie.
 */
export async function verifyChallenge(
  cookieValue: string,
  type: "register" | "login"
): Promise<{ challenge: string; userId: string | null }> {
  const dotIdx = cookieValue.indexOf(".");
  const b64payload = dotIdx >= 0 ? cookieValue.substring(0, dotIdx) : "";
  const sig = dotIdx >= 0 ? cookieValue.substring(dotIdx + 1) : "";
  if (!b64payload || !sig) throw new Error("Invalid challenge cookie");

  const payloadStr = atob(b64payload.replace(/-/g, "+").replace(/_/g, "/"));
  const expectedSig = await hmacSign(payloadStr);

  if (sig !== expectedSig) throw new Error("Challenge signature mismatch");

  const payload = JSON.parse(payloadStr);
  if (payload.t !== type) throw new Error("Wrong challenge type");
  if (payload.e < Date.now()) throw new Error("Challenge expired");

  return {
    challenge: payload.c,
    userId: payload.u,
  };
}
