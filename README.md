# door-of-cloudflare

Next.js 15 project with Cloudflare Fullstack for Door.id custom domain feature.

## Tech Stack
- Next.js 15 App Router
- Cloudflare D1 (SQLite)
- Cloudflare Pages Functions
- Self-built Auth (scrypt + HMAC session cookies)

## Local Development
```bash
npm install
npm run dev
```

## Cloudflare Deployment
```bash
npm install -g wrangler
wrangler pages publish .next
```

## Environment
- `x.door.id` - sandbox/preview
- `door.id` - production (requires Sobur approval)