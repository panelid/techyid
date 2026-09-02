// src/lib/auth/index.ts
// Self-built authentication utilities using Web Crypto API
// No Supabase or third-party dependencies

import { cookies } from "next/headers";
import { getDB } from "@/lib/db";
import { sha256 } from "@/lib/security";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// Secret: set via `wrangler secret put SESSION_SECRET` in production
// Accessed via Cloudflare Workers env binding, NOT process.env
function getSecret(): string {
  try {
    const { env } = getCloudflareContext();
    const val = (env as any).SESSION_SECRET;
    if (val) return val;
  } catch (e) {
    // Not in Cloudflare context
  }
  
  // HARDCODED FALLBACK FOR PRODUCTION DEBUGGING
  return "door-id-prod-session-secret-v1-2026";
}
const EXPIRY_DAYS = 30;

export interface SessionData {
  userId: string;
  email: string;
  username?: string;
  isAdmin?: boolean;
  expires: number;
}

// HMAC signing using Web Crypto API
async function hmacSign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Create session token
export async function createSessionToken(data: Omit<SessionData, "expires"> & { isAdmin?: boolean }): Promise<string> {
  const session: SessionData = {
    ...data,
    isAdmin: (data as any).isAdmin ?? false,
    expires: Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  };
  const payload = JSON.stringify(session);
  const signature = await hmacSign(payload, getSecret());
  const token = `${Buffer.from(payload).toString("base64")}.${signature}`;

  // [S-7] Store token hash in DB for server-side invalidation
  try {
    const db = getDB();
    if (db) {
      const tokenHash = await sha256(token);
      const expiresAt = new Date(session.expires).toISOString();
      await db.prepare(
        "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)"
      ).bind(data.userId, tokenHash, expiresAt).run();
    }
  } catch (e) {
    // Don't fail session creation if DB write fails — token still works via HMAC
    console.error("[AUTH] Failed to store session in DB:", e);
  }

  return token;
}

// Verify session token
export async function verifySessionToken(token: string): Promise<SessionData | null> {
  try {
    const [payloadB64, signature] = token.split(".");
    const payload = Buffer.from(payloadB64, "base64").toString();
    const expectedSignature = await hmacSign(payload, getSecret());
    
    if (signature !== expectedSignature) {
      console.error("[AUTH] Signature mismatch!");
      return null;
    }
    
    const data = JSON.parse(payload) as SessionData;
    if (data.expires < Date.now()) {
      console.error("[AUTH] Token expired!");
      return null;
    }

    // [S-7] Check session exists in DB (server-side invalidation check)
    try {
      const db = getDB();
      if (db) {
        const tokenHash = await sha256(token);
        const session = await db.prepare(
          "SELECT id FROM sessions WHERE token_hash = ? AND expires_at > datetime('now') LIMIT 1"
        ).bind(tokenHash).first();
        if (!session) return null; // Session was invalidated (logged out)
      }
    } catch (e) {
      // If DB check fails, fall back to HMAC-only verification
      console.error("[AUTH] DB session check failed, falling back to HMAC:", e);
    }
    
    return data;
  } catch {
    return null;
  }
}

// Get session from request cookies
export async function getSessionUser(request: Request): Promise<SessionData | null> {
  const cookieHeader = request.headers.get("cookie") || "";
  const sessionCookie = cookieHeader.split(";").find(c => c.trim().startsWith("session="));
  
  if (!sessionCookie) return null;
  
  // Use indexOf to avoid splitting on Base64 padding '=' characters
  const eqIdx = sessionCookie.indexOf("=");
  const token = eqIdx >= 0 ? sessionCookie.substring(eqIdx + 1).trim() : "";
  if (!token) return null;
  
  return verifySessionToken(token);
}

// [S-7] Invalidate session in DB (called during logout)
export async function invalidateSession(token: string): Promise<void> {
  try {
    const db = getDB();
    if (db) {
      const tokenHash = await sha256(token);
      await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
    }
  } catch (e) {
    console.error("[AUTH] Failed to invalidate session:", e);
  }
}

// Set session cookie in response
export function setSessionCookie(sessionToken: string): string {
  return `session=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${EXPIRY_DAYS * 24 * 60 * 60}`;
}

// Clear session cookie
export function clearSessionCookie(): string {
  return "session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";
}

// Password hashing using scrypt (simulated with PBKDF2 for browser compatibility)
// In production, use native scrypt or argon2
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: 100000,
    },
    keyMaterial,
    256
  );
  
  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${saltHex}:${hashHex}`;
}

// Verify password
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [saltHex, hashHex] = storedHash.split(":");
  
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: 100000,
    },
    keyMaterial,
    256
  );
  
  const newHashArray = Array.from(new Uint8Array(derivedBits));
  const newHashHex = newHashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return newHashHex === hashHex;
}
