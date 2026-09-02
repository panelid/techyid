# Door.id v6 — PRD (Product Requirements Document)

## Overview
Rebuild Door.id dari nol menggunakan **Full Cloudflare Stack** dengan Next.js 15 + OpenNext. Fresh start tanpa data migration. Deploy di `x.door.id` (sandbox) dulu, lalu `door.id` (production) setelah verified.

## Target User
- Individu yang butuh link management (short link, paste, link-in-bio)
- UMKM/brand yang ingin custom domain untuk link mereka

## Tech Stack

| Layer | Teknologi |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui (new-york) |
| Hosting | Cloudflare Pages + Workers via OpenNext (`@opennextjs/cloudflare`) |
| Database | Cloudflare D1 (SQLite) |
| Storage | Cloudflare R2 (avatar, QR codes) |
| Auth | Self-built: scrypt + HMAC session cookies + Google OAuth + WebAuthn/Passkeys |
| DNS | Cloudflare DNS (custom domain routing) |

## Fitur MVP

### 1. Short Link + Redirect
- User buat short link: `x.door.id/my-slug` → redirect ke target URL
- **Custom domain**: `domainuser.com/my-slug` → redirect juga
- Analytics: hit counter per link

### 2. Paste + Password Protection
- User paste text → generate link (`x.door.id/paste/abc123`)
- Opsional: password protection → visitor harus masukkan password dulu

### 3. Link-in-Bio (Linktree Alternative)
- User bisa bikin halaman profil: `x.door.id/username`
- Tampilan: list clickable links

### 4. QR Code Generator
- Setiap short link → generate QR code (download PNG)
- Bisa generate QR untuk custom domain juga

### 5. Dashboard User
- Lihat semua links/pastes yang sudah dibuat
- Edit/delete links
- Lihat analytics (total visits)
- **Custom Domain Management**: tambah/verifikasi domain kustom

### 6. Custom Domain Support
- User tambah domain kustom di dashboard
- Verifikasi via DNS TXT record (`door-verify=xxx`)
- CNAME record ke Cloudflare
- Short link user langsung jalan di domain kustom

### 7. Auth (Tanpa Pihak Ketiga)
- Email + Password (scrypt hashing)
- Google OAuth (custom, tanpa Supabase)
- WebAuthn/Passkeys (self-built)

## Arsitektur Routing Custom Domain

```
domainuser.com/my-slug
    ↓
Cloudflare Workers (OpenNext)
    ↓ Middleware: detect hostname ≠ door.id → set header x-door-custom-domain
    ↓
/[slug]/page.tsx
    ↓ query custom_domains table by domain → get user_id
    ↓ query slugs table by user_id + slug
    ↓
Redirect / Render
```

## Estimasi

| Fase | Durasi |
|---|---|
| Setup project + CF integration | 2-3 jam |
| Auth system (scrypt, HMAC, OAuth, Passkey) | 4-5 jam |
| Short link + paste + redirect | 2-3 jam |
| Dashboard UI | 3-4 jam |
| Custom domain management | 2-3 jam |
| Custom domain routing | 2-3 jam |
| Testing + bug fix | 2-3 jam |
| **Total** | **17-24 jam** |

## Deployment Strategy
1. Build & test lokal (wrangler dev)
2. Deploy ke `x.door.id` (CF Pages preview)
3. Test end-to-end semua fitur
4. Setelah verified → deploy ke `door.id` (production)

---

**Menunggu approval Sobur untuk lanjut ke implementasi.**
