# Techy.id (Clone of Door.id) — Agent Context

## Stack
- Next.js 16 (App Router) + Tailwind v4 + shadcn/ui
- Cloudflare Workers via OpenNext (`@opennextjs/cloudflare`)
- Database: Cloudflare D1 (`techy-db`)
- KV: `TECHY_SLUGS`
- Auth: Self-built (scrypt + HMAC session cookies + Google OAuth + WebAuthn/Passkey)
- Email: Cloudflare Email Routing (receive) + Resend (send)

## Environment
- techy.id = production instance (cloned from door-cf / x.door.id)
- Account: Sbr.126.sbr@gmail.com (4373c9cc...)
- Zone: techy.id (37bc4e29...) — NS must be set at registrar: ivy.ns.cloudflare.com, jeff.ns.cloudflare.com
- Deploy: GitHub Actions → wrangler deploy (CI-only, no local wrangler on Termux)

## Secrets (GitHub repo + Worker)
- CLOUDFLARE_API_TOKEN (cfat_*) — Workers:Edit, D1:Edit, Zone:Edit for techy.id
- CLOUDFLARE_ACCOUNT_ID = 4373c9cc85d5918cdc74ddf90bd31b63
- Worker secrets: SESSION_SECRET, RESEND_API_KEY (re_...), CF_API_TOKEN, CF_ZONE_ID (37bc4e29...), CF_API_EMAIL

## Rules
- Don't overwrite working components — extend.
- Run build before push.
- D1 free tier = 5M reads/day per ACCOUNT. This account is separate from ponpes (14750966...), so quota is isolated.
- Heavy Playwright E2E runs only on PR/manual dispatch, never on push (saves D1 quota).
- Admin read endpoints use in-memory TTL cache + Cache-Control headers.

## Differences from door-cf
- Domain: techy.id (not door.id/x.door.id)
- D1: techy-db (not door-db)
- KV: TECHY_SLUGS (not DOOR_SLUGS)
- Separate Cloudflare account (separate D1 quota)
