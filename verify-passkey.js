// verify-passkey.js
// Verify passkey API endpoints respond correctly (without requiring real biometric hardware).
// Checks: registration options require auth; login options return valid WebAuthn payload;
// and full register flow returns 401 without session / proper errors with session.

const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'https://x.door.id';
let passed = 0, failed = 0;

function log(name, ok, extra = '') {
  if (ok) { passed++; console.log(`  ✅ ${name}${extra ? ' — ' + extra : ''}`); }
  else { failed++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  console.log(`🔍 Verifying passkey (WebAuthn) API on ${BASE}...`);

  // ========== 1. Register options without session → 401 ==========
  console.log('\n--- Register options (no auth) ---');
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const res = await page.request.post(`${BASE}/api/auth/passkey/register/options`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const body = await res.json();
    log('[Register options] 401 when not logged in', res.status() === 401, `status=${res.status()} body=${JSON.stringify(body).slice(0, 60)}`);
    await ctx.close();
  }

  // ========== 2. Login options (no email) → valid WebAuthn payload ==========
  console.log('\n--- Login options (no email, any passkey) ---');
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const res = await page.request.post(`${BASE}/api/auth/passkey/login/options`, {
      headers: { 'Content-Type': 'application/json' },
      data: {},
    });
    const body = await res.json();
    const hasChallenge = !!(body.options && body.options.challenge);
    const hasRpID = !!(body.rpID || (body.options && body.options.rpID));
    log('[Login options] Returns challenge', hasChallenge);
    log('[Login options] Returns rpID', hasRpID, `rpID=${body.rpID}`);
    log('[Login options] timeout present', !!(body.options && body.options.timeout));
    log('[Login options] 200 status', res.status() === 200, `status=${res.status()}`);
    await ctx.close();
  }

  // ========== 3. Login options with unknown email → 404 ==========
  console.log('\n--- Login options (unknown email) ---');
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const res = await page.request.post(`${BASE}/api/auth/passkey/login/options`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email: `nobody-${Date.now()}@test.com` },
    });
    log('[Login options] 404 for unknown email', res.status() === 404, `status=${res.status()}`);
    await ctx.close();
  }

  // ========== 4. Login options with known email but no passkeys → 404 ==========
  console.log('\n--- Login options (email without passkeys) ---');
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    // Register a fresh user (has no passkeys yet)
    const email = `pk-${Date.now()}@test.com`;
    const reg = await page.request.post(`${BASE}/api/auth/register`, {
      headers: { 'Content-Type': 'application/json', 'x-ci-test': 'true' },
      data: { email, password: 'Passw0rd123', username: `pk${Date.now()}` },
    });
    const res = await page.request.post(`${BASE}/api/auth/passkey/login/options`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email },
    });
    log('[Login options] 404 when user has no passkeys', res.status() === 404, `status=${res.status()}`);
    await ctx.close();
  }

  // ========== 5. Register options with valid session → 200 with options ==========
  console.log('\n--- Register options (logged in) ---');
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const email = `pkreg-${Date.now()}@test.com`;
    const reg = await page.request.post(`${BASE}/api/auth/register`, {
      headers: { 'Content-Type': 'application/json', 'x-ci-test': 'true' },
      data: { email, password: 'Passw0rd123', username: `pkreg${Date.now()}` },
    });
    // Extract session cookie from Set-Cookie header directly
    const setCookie = reg.headers()['set-cookie'] || '';
    const session = setCookie.includes('session=') ? 'yes' : null;
    log('[Register options] Session established', !!session, `status=${reg.status()}${reg.status()===429?' (rate limited)':''}`);

    if (session) {
      const res = await page.request.post(`${BASE}/api/auth/passkey/register/options`, {
        headers: { 'Content-Type': 'application/json' },
      });
      const body = await res.json();
      const hasOptions = !!(body.options && body.options.challenge && body.options.rp);
      log('[Register options] Returns options with challenge', hasOptions);
      log('[Register options] rp.id = hostname', body.options?.rp?.id === 'x.door.id', `rp.id=${body.options?.rp?.id}`);
      log('[Register options] 200 status', res.status() === 200, `status=${res.status()}`);
    }
    await ctx.close();
  }

  // ========== 6. Verify with garbage data → 400 (not 500) ==========
  console.log('\n--- Register verify (bad payload) ---');
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const email = `pkbad-${Date.now()}@test.com`;
    await page.request.post(`${BASE}/api/auth/register`, {
      headers: { 'Content-Type': 'application/json', 'x-ci-test': 'true' },
      data: { email, password: 'Passw0rd123', username: `pkbad${Date.now()}` },
    });
    // Get register options first (sets challenge cookie)
    await page.request.post(`${BASE}/api/auth/passkey/register/options`, {
      headers: { 'Content-Type': 'application/json' },
    });
    // Send garbage — should fail verification with 400, NOT 500
    const res = await page.request.post(`${BASE}/api/auth/passkey/register/verify`, {
      headers: { 'Content-Type': 'application/json' },
      data: { id: 'garbage', rawId: 'garbage', type: 'public-key', response: { clientDataJSON: 'garbage', attestationObject: 'garbage' } },
    });
    log('[Register verify] Garbage rejected with 4xx (not 500)', res.status() >= 400 && res.status() < 500, `status=${res.status()}`);
    await ctx.close();
  }

  await browser.close();

  console.log(`\n══════════════════════════════════`);
  console.log(`=== PASSKEY API VERIFICATION RESULTS ===`);
  console.log(`  ✅ ${passed} passed, ❌ ${failed} failed`);
  console.log(`========================================`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
