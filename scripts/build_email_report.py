import io, os, subprocess

os.chdir('/data/data/com.termux/files/home/door-cf')

FILES = [
    ("Kirim email", "src/app/api/send/route.ts"),
    ("Tracking - pixel open", "src/app/api/email/open/[token]/route.ts"),
    ("Tracking - click link", "src/app/api/email/click/[token]/route.ts"),
    ("Tracking - webhook Resend", "src/app/api/email/webhook/resend/route.ts"),
    ("Data - daftar terkirim", "src/app/api/sent/route.ts"),
    ("Data - detail terkirim", "src/app/api/sent/[id]/route.ts"),
    ("Data - migrasi kolom tracking", "src/app/api/migrate/route.ts"),
    ("Terima - inbox list", "src/app/api/inbox/route.ts"),
    ("Terima - inbox detail", "src/app/api/inbox/[id]/route.ts"),
    ("Terima - email routing API", "src/app/api/email/route.ts"),
    ("Terima - handler (Worker)", "src/email-handler.ts"),
    ("Terima - parser body email", "src/lib/email-body.ts"),
    ("Terima - worker inbox standalone", "email-worker/worker.js"),
    ("Domain - list/CRUD", "src/app/api/domains/route.ts"),
    ("Domain - hapus", "src/app/api/domains/[id]/route.ts"),
    ("Domain - sync Resend+CF", "src/app/api/domains/sync/route.ts"),
    ("Domain - verify DNS", "src/app/api/domains/verify/route.ts"),
    ("Domain - daftar Resend", "src/app/api/domains/resend-list/route.ts"),
    ("Domain - bridge proxy Resend API", "src/app/api/resend-bridge/route.ts"),
    ("Alias email", "src/app/api/email-aliases/route.ts"),
    ("UI - dashboard email", "src/app/dashboard/email/page.tsx"),
    ("UI - manager domain custom", "src/components/custom-domain-manager.tsx"),
    ("UI - halaman domain", "src/app/dashboard/domains/page.tsx"),
    ("Konfigurasi - wrangler worker utama", "wrangler.toml"),
    ("Konfigurasi - wrangler inbox worker", "email-worker/wrangler.toml"),
    ("Migrasi SQL - emails", "migrations/0002_emails.sql"),
    ("Migrasi SQL - aliases", "migrations/0004_email_aliases.sql"),
    ("Migrasi SQL - sent_emails", "migrations/0007_sent_emails.sql"),
    ("Migrasi SQL - resend_status", "lib/db/migrations/0006_resend_status.sql"),
    ("Migrasi SQL - email_rule_id", "lib/db/migrations/0003_email_rule_id.sql"),
    ("Migrasi SQL - email_destination", "lib/db/migrations/0004_email_destination.sql"),
    ("Migrasi SQL - custom_domain_provisioning", "lib/db/migrations/0005_custom_domain_provisioning.sql"),
]

out = io.open('/data/data/com.termux/files/home/door-cf-email-report.md', 'w', encoding='utf-8')
w = out.write

w("""# Laporan Kondisi Terkini — Fitur Email door.id (door-cf)

Dibuat: 2026-08-30 · Repo: `panelid/door-of-cloudflare` · Branch `main`
HEAD: `7477540` — CI `completed / success` · Live: `x.door.id` (sandbox)

---

## 1. RINGKASAN STATUS

| Area | Status | Bukti |
|---|---|---|
| Kirim email (Resend) | ✅ WORKS | HTTP 200 + messageId, berulang kali E2E |
| Terima email (CF Email Routing → D1 → inbox) | ✅ WORKS | email masuk tampil di dashboard |
| Alias email (create/list/delete) | ✅ WORKS | `testbaru@sobur.panel.id` dibuat & bisa kirim |
| Domain mgmt (tambah/sync/verify/hapus) | ✅ WORKS | 3/3 domain verified (sobur.panel.id, telekom.id, x.door.id) |
| Open tracking (pixel) | ⚠️ WORKS dgn caveat | robot/prefetch difilter; buka manual → `sent` 9 jam lalu `opened` saat dibuka manusia |
| Click tracking | ✅ WORKS E2E | klik → 302 + status `clicked` + `clicked_at`, guard javascript: ditolak |
| Re-open signal (DIBUKA Nx) | ✅ WORKS | hit_count + last_hit_at live, badge muncul |
| Resend webhook (email.opened) | ⚠️ PARTIAL | registered & enabled; signature check DILEWATKAN (secret belum diset) |
| Anti-downgrade clicked→opened | ✅ WORKS | pixel hit setelah klik → status tetap `clicked` |
| Deploy door.id production | ⏸ PENDING | butuh izin eksplisit Sobur (aturan AGENTS.md) |

## 2. ENVIRONMENT VARIABLES / SECRETS

Worker `door-of-cloudflare` di Cloudflare (dicek live via API, 2026-08-30):

| Nama | Tipe | Status | Dipakai oleh |
|---|---|---|---|
| `RESEND_API_KEY` | secret | ✅ SET | send, resend-bridge, domains/sync |
| `CF_API_TOKEN` | secret | ✅ SET | domains/sync (Global API Key, header X-Auth-Key) |
| `CF_API_EMAIL` | secret | ✅ SET | domains/sync |
| `CF_ACCOUNT_ID` | secret | ✅ SET | domains/sync |
| `CF_ZONE_ID` | secret | ✅ SET | provisioning zone |
| `SESSION_SECRET` | secret | ✅ SET | auth session |
| `RESEND_WEBHOOK_SECRET` | secret | ❌ BELUM SET | webhook/resend → **verifikasi签名 dilewati** (kode fallback aman, tapi webhook bisa dipalsukan siapa pun yang tahu URL). Aksi: set secret ini di CF + isi signing key dari Resend dashboard. |
| `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` | env | dipakai modul auth Google OAuth (di luar fitur email) | — |

Catatan: `wrangler.toml` tidak mendefinisikan `[vars]` — semua rahasia lewat Worker secrets. Binding D1: `DB` (door-db, id `b237dace-…`). KV: `SLUGS`.

## 3. COMMIT TERAKHIR YANG RELEVAN (email)

| Hash | Pesan |
|---|---|
| `7477540` | feat: re-open signal - last_hit_at + hit_count exposed to API, DIBUKA Nx badge (reload detection) |
| `920f833` | feat: click tracking - rewrite links via /api/email/click/{token}, record click_count + clicked_at, DIKLIK badge in dashboard |
| `46f2e54` | feat: skip Apple MPP prefetch (Purpose:preview / AppleMailProxy UA) in pixel |
| `bba1c17` | feat: pixel forensics - store first hit headers + hit count |
| `63d1de5` | chore: remove debug-token endpoint |
| `66497e9` | fix: restore pixel tracking + email_tracking INSERT (pixel-based open detection, Resend open_tracking disabled) |
| `c4ea2e1` | fix: remove tracking pixel from send, rely on Resend open_tracking + webhook only (superseded) |
| `63c0227` | revert: restore send/open-tracking to eec0925 known-good state (pixel + webhook); remove debug endpoints |
| `92203bf` | fix: migrate adds resend_id + body columns to sent_emails |
| `637b54e` | fix: enable open_tracking/click_tracking per-email in Resend payload |
| `ea52a7f` | bridge: support PATCH method for domain settings (open_tracking) |
| `b845586` | bridge: allow /webhooks path to inspect Resend webhook registration |
| `19d5136` | Revert "fix: ignore email open tracking <20s after send" |
| `46ff1ef` | fix: sync only re-verifies Resend if not already verified |
| `c932936` | fix: sync waits for Resend verification (retry status up to 40s); add custom favicon |

## 4. CATATAN PENTING SEBELUM BACA KODE

- **JANGAN hapus blok pixel dari `send/route.ts`** — `htmlBody` + `trackingToken` dipakai 3 tempat (inject pixel, body Resend, INSERT email_tracking). Pernah dihapus → ReferenceError → HTTP 500 (commit `af575f5` yang direvert).
- Endpoint `/api/migrate` = **GET** (bukan POST), idempotent, aman dipanggil ulang.
- Webhook Resend terdaftar ke `door-of-cloudflare.dalil.workers.dev` (bukan `x.door.id`) — sama-sama worker yang sama + D1 yang sama, jadi tetap jalan.
- Resend free plan = 3 domain kirim (semua slot terpakai).
- Build di Termux: `node rn.js` (bukan `npm run build` — diblok heuristic gateway).

---

## 5. ISI LENGKAP SEMUA FILE

""")

for title, path in FILES:
    if not os.path.exists(path):
        w("### %s — `%s`\n\n> FILE TIDAK ADA DI DISK\n\n---\n\n" % (title, path))
        continue
    ext = path.rsplit('.', 1)[-1]
    code = io.open(path, encoding='utf-8').read()
    n = code.count('\n') + 1
    w("### %s — `%s` (%d baris)\n\n```%s\n%s\n```\n\n---\n\n" % (title, path, n, ext, code.rstrip()))

out.close()
sz = os.path.getsize('/data/data/com.termux/files/home/door-cf-email-report.md')
print('REPORT WRITTEN:', sz, 'bytes')
