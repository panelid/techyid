// src/lib/security.ts
// Shared security utilities: reserved paths, rate limiting, URL validation

import { getDB } from "@/lib/db";

// ── SHA-256 Hash (Web Crypto API — works in Cloudflare Workers) ──

/** Hash a string with SHA-256, returns hex string */
export async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Reserved Path Blocklist ──
const RESERVED_PATHS = new Set([
  'api', 'login', 'register', 'logout', 'dashboard', 'settings',
  '_next', 'docs', 'admin', 'static', 'public', 'favicon.ico',
  'robots.txt', 'sitemap.xml', '.well-known',
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_PATHS.has(slug.toLowerCase());
}

/**
 * Check rate limit — wrapped in try/catch so D1 failures fail open.
 */
export async function checkRateLimit(
  ip: string,
  action: string,
  maxAttempts: number,
  windowMs: number
): Promise<{ limited: boolean; remaining: number; retryAfterMs: number }> {
  try {
    const db = getDB();
    if (!db) return { limited: false, remaining: maxAttempts, retryAfterMs: 0 };

    const key = `${action}:${ip}`;
    const now = Date.now();
    const resetAt = now + windowMs;

    const existing = await db.prepare(
      "SELECT count, reset_at FROM rate_limits WHERE key = ? LIMIT 1"
    ).bind(key).first();

    if (!existing || (existing.reset_at as number) <= now) {
      await db.prepare(
        "INSERT OR REPLACE INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)"
      ).bind(key, resetAt).run();
      return { limited: false, remaining: maxAttempts - 1, retryAfterMs: 0 };
    }

    const newCount = (existing.count as number) + 1;

    if (newCount > maxAttempts) {
      const retryAfterMs = (existing.reset_at as number) - now;
      return { limited: true, remaining: 0, retryAfterMs };
    }

    await db.prepare(
      "UPDATE rate_limits SET count = ? WHERE key = ?"
    ).bind(newCount, key).run();

    return { limited: false, remaining: maxAttempts - newCount, retryAfterMs: 0 };
  } catch (e) {
    // Fail open — don't block users if rate limiter has issues
    console.error("[RATE-LIMIT] D1 error, failing open:", e);
    return { limited: false, remaining: maxAttempts, retryAfterMs: 0 };
  }
}

/**
 * Get client IP from request headers (Cloudflare sets CF-Connecting-IP)
 */
export function getClientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

/**
 * Create a 429 Too Many Requests response
 */
export function rateLimitResponse(retryAfterMs: number): Response {
  const retryAfterSec = Math.ceil(retryAfterMs / 1000);
  return new Response(
    JSON.stringify({
      error: `Terlalu banyak percobaan. Coba lagi dalam ${retryAfterSec} detik.`,
      retryAfter: retryAfterSec,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSec),
      },
    }
  );
}
