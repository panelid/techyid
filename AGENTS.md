# Techy.id (Clone of Door.id) — Agent Context

## Stack
- Next.js 16 (App Router) + Tailwind v4 + shadcn/ui
- Cloudflare Workers via OpenNext (`@opennextjs/cloudflare`)
- Database: Cloudflare D1 (`techy-db`)
- KV: `TECHY_SLUGS`
- Auth: Self-built (scrypt + HMAC session cookies)
- Email: Cloudflare Email Routing (receive) + Resend (send)

## Environment
- techy.id = production instance (cloned from door-cf / x.door.id)
- Account: Sbr.126.sbr@gmail.com (4373c9cc...)
- Zone: techy.id (37bc4e29...) — ACTIVE
- Deploy: GitHub Actions → wrangler deploy (CI-only)

## Secrets
- GitHub repo secrets: CLOUDFLARE_API_TOKEN (cfat_*), CLOUDFLARE_ACCOUNT_ID, RESEND_API_KEY, CF_ZONE_ID, CF_API_EMAIL
- Worker secrets auto-set by CI (deploy.yml): SESSION_SECRET (random per deploy), RESEND_API_KEY, CF_API_TOKEN, CF_ZONE_ID, CF_API_EMAIL

## Rules
- D1 free tier = 5M reads/day per ACCOUNT. This account is SEPARATE from ponpes (14750966...), so quota isolated.
- Heavy Playwright E2E runs only on PR/manual dispatch (saves D1 quota).
- Admin read endpoints use in-memory TTL cache + Cache-Control headers.

## Differences from door-cf
- Domain: techy.id (not door.id/x.door.id)
- D1: techy-db (not door-db)
- KV: TECHY_SLUGS (not DOOR_SLUGS)
- Separate Cloudflare account (separate D1 quota)
