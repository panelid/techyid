---
# Door.id (CF-Full Rebuild) — Agent Context

## Stack Baru (Full Cloudflare + OpenNext)
- Framework: Next.js 16 (App Router) + Tailwind v4 + shadcn/ui
- Hosting: Cloudflare Pages / Workers via OpenNext (`@opennextjs/cloudflare`)
- Database: Cloudflare D1 (SQLite)
- Storage: Cloudflare R2
- Auth: Self-built (scrypt + HMAC session cookies + Google OAuth + WebAuthn/Passkey)
- DNS/Routing: Cloudflare Workers / Custom Domains (`*.door.id` & user custom domains)

## Environment
- x.door.id = sandbox/preview — semua eksperimen di sini dulu
- door.id = production — deploy hanya setelah izin eksplisit Sobur

## Rules Wajib
- Baca struktur repo aktual dari disk sebelum coding apapun
- Jangan replace komponen yang sudah berjalan — extend, jangan overwrite
- Setiap fitur baru: test di x.door.id dulu
- Jalankan npm run build sebelum push apapun

## Fitur Wajib (MVP)
- Short link + redirect (/[slug]) dengan support custom domain (domain.com/slug)
- Paste dengan password protection
- Landing page Next.js (src/app/page.tsx + src/components/LandingClient.tsx)
- Dashboard user & custom domain management
- Auth (Email/Password, Google OAuth, Passkey) tanpa Supabase/pihak ketiga

## CI/CD
- GitHub Actions: .github/workflows/deploy.yml
- Deploy: Cloudflare Workers via OpenNext
- Visual verification: Playwright screenshot → artifact "visual-verification"
---
