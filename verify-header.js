// verify-header.js
// Playwright E2E verification for header/navbar refactor + auth flow redirects
// Run against deployed https://x.door.id from GitHub Actions (ubuntu-latest)

const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'https://x.door.id';
const SHOT_DIR = './header-shots';

let passed = 0;
let failed = 0;
const failures = [];

function log(name, ok, extra = '') {
  if (ok) { passed++; console.log(`  ✅ ${name}${extra ? ' — ' + extra : ''}`); }
  else { failed++; failures.push(name); console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const fs = require('fs');
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  // ---------- Helpers ----------
  async function createSessionCookie() {
    // Register a fresh user and return the session cookie value
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const email = `hdr-${Date.now()}@test.com`;
    const regResp = await page.request.post(`${BASE}/api/auth/register`, {
      headers: { 'Content-Type': 'application/json', 'x-ci-test': 'true' },
      data: { email, password: 'Passw0rd123', username: `hdr${Date.now()}` },
    });
    const body = await regResp.json();
    const cookies = await ctx.cookies();
    const session = cookies.find(c => c.name === 'session');
    await ctx.close();
    return { email, sessionValue: session ? session.value : null, body };
  }

  async function captureOverflow(page, label) {
    return page.evaluate(() => ({
      docW: document.documentElement.scrollWidth,
      winW: window.innerWidth,
      bodyW: document.body.scrollWidth,
    }));
  }

  // ---------- Setup ----------
  console.log(`🔍 Verifying header/auth flow on ${BASE}...`);

  // ========== 1. DESKTOP — NOT LOGGED IN ==========
  console.log('\n--- Desktop (1280x800) — NOT logged in ---');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await delay(800);

    // Overflow check
    const ov = await captureOverflow(page);
    log('[Desktop] No horizontal overflow', ov.docW <= ov.winW, `doc=${ov.docW}/${ov.winW}`);

    // Buttons should show Masuk + Daftar, NOT Dashboard
    const masukVisible = await page.locator('.nav-auth').locator('text=Masuk').first().isVisible().catch(() => false);
    const daftarVisible = await page.locator('.nav-auth').locator('text=Daftar').first().isVisible().catch(() => false);
    const dashVisible = await page.locator('.nav-auth').locator('text=Dashboard').first().isVisible().catch(() => false);
    log('[Desktop] "Masuk" button visible', masukVisible);
    log('[Desktop] "Daftar" button visible', daftarVisible);
    log('[Desktop] "Dashboard" NOT visible (logged out)', !dashVisible);

    await page.screenshot({ path: `${SHOT_DIR}/desktop-loggedout.png`, fullPage: true });
    console.log('    Screenshot: desktop-loggedout.png');
    await ctx.close();
  }

  // ========== 2. DESKTOP — LOGGED IN ==========
  console.log('\n--- Desktop (1280x800) — logged in ---');
  {
    const { sessionValue } = await createSessionCookie();
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    if (sessionValue) await ctx.addCookies([{ name: 'session', value: sessionValue, url: BASE }]);
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await delay(800);

    const dashVisible = await page.locator('.nav-auth').locator('text=Dashboard').first().isVisible().catch(() => false);
    const masukVisible = await page.locator('.nav-auth').locator('text=Masuk').first().isVisible().catch(() => false);
    const daftarVisible = await page.locator('.nav-auth').locator('text=Daftar').first().isVisible().catch(() => false);
    log('[Desktop] "Dashboard" button visible (logged in)', dashVisible);
    log('[Desktop] "Masuk" NOT visible', !masukVisible);
    log('[Desktop] "Daftar" NOT visible', !daftarVisible);

    await page.screenshot({ path: `${SHOT_DIR}/desktop-loggedin.png`, fullPage: true });
    console.log('    Screenshot: desktop-loggedin.png');
    await ctx.close();
  }

  // ========== 3. MOBILE — NOT LOGGED IN (hamburger) ==========
  console.log('\n--- Mobile (375x667) — NOT logged in, hamburger menu ---');
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await delay(800);

    // Overflow
    const ov = await captureOverflow(page);
    log('[Mobile] No horizontal overflow', ov.docW <= ov.winW, `doc=${ov.docW}/${ov.winW}`);

    // Hamburger visible; desktop nav-auth hidden
    const hamVisible = await page.locator('.hamburger').isVisible().catch(() => false);
    const desktopAuthHidden = await page.locator('.nav-auth').isHidden().catch(() => false);
    log('[Mobile] Hamburger icon visible', hamVisible);
    log('[Mobile] Desktop auth buttons hidden', desktopAuthHidden);

    // Open hamburger
    await page.click('.hamburger');
    await delay(500);
    const menuOpen = await page.locator('.mobile-menu.open').isVisible().catch(() => false);
    log('[Mobile] Hamburger menu opens', menuOpen);

    const mmMasuk = await page.locator('.mobile-menu').locator('text=Masuk').first().isVisible().catch(() => false);
    const mmDaftar = await page.locator('.mobile-menu').locator('text=Daftar').first().isVisible().catch(() => false);
    const mmDash = await page.locator('.mobile-menu').locator('text=Dashboard').first().isVisible().catch(() => false);
    log('[Mobile] Menu shows "Masuk" (logged out)', mmMasuk);
    log('[Mobile] Menu shows "Daftar" (logged out)', mmDaftar);
    log('[Mobile] Menu does NOT show "Dashboard"', !mmDash);

    await page.screenshot({ path: `${SHOT_DIR}/mobile-loggedout-menu.png`, fullPage: true });
    console.log('    Screenshot: mobile-loggedout-menu.png');
    await ctx.close();
  }

  // ========== 4. MOBILE — LOGGED IN (hamburger) ==========
  console.log('\n--- Mobile (375x667) — logged in, hamburger menu ---');
  {
    const { sessionValue } = await createSessionCookie();
    const ctx = await browser.newContext({ viewport: { width: 375, height: 667 } });
    if (sessionValue) await ctx.addCookies([{ name: 'session', value: sessionValue, url: BASE }]);
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await delay(800);

    await page.click('.hamburger');
    await delay(500);
    const mmDash = await page.locator('.mobile-menu').locator('text=Dashboard').first().isVisible().catch(() => false);
    const mmProfil = await page.locator('.mobile-menu').locator('text=Profil').first().isVisible().catch(() => false);
    const mmMasuk = await page.locator('.mobile-menu').locator('text=Masuk').first().isVisible().catch(() => false);
    const mmDaftar = await page.locator('.mobile-menu').locator('text=Daftar').first().isVisible().catch(() => false);
    log('[Mobile] Menu shows "Dashboard" (logged in)', mmDash);
    log('[Mobile] Menu shows "Profil" (logged in)', mmProfil);
    log('[Mobile] Menu does NOT show "Masuk"', !mmMasuk);
    log('[Mobile] Menu does NOT show "Daftar"', !mmDaftar);

    await page.screenshot({ path: `${SHOT_DIR}/mobile-loggedin-menu.png`, fullPage: true });
    console.log('    Screenshot: mobile-loggedin-menu.png');
    await ctx.close();
  }

  // ========== 5. LANGUAGE TOGGLE ==========
  console.log('\n--- Language toggle (single switch) ---');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await delay(600);

    // Check initial: data-lang="id" (Indonesian)
    const initialLang = await page.locator('.lang-toggle').getAttribute('data-lang');
    log('[Lang] Initial state = id', initialLang === 'id', `data-lang=${initialLang}`);

    // Click the toggle anywhere → switches to EN
    await page.click('.lang-toggle');
    await delay(400);
    const afterClick = await page.locator('.lang-toggle').getAttribute('data-lang');
    log('[Lang] Click switches to en', afterClick === 'en', `data-lang=${afterClick}`);
    const enTextVisible = await page.locator('[data-en]').first().isVisible().catch(() => false);
    log('[Lang] English content shown after toggle', enTextVisible);

    // Click again → back to ID
    await page.click('.lang-toggle');
    await delay(400);
    const afterSecond = await page.locator('.lang-toggle').getAttribute('data-lang');
    log('[Lang] Second click back to id', afterSecond === 'id', `data-lang=${afterSecond}`);

    await page.screenshot({ path: `${SHOT_DIR}/lang-toggle.png` });
    console.log('    Screenshot: lang-toggle.png');
    await ctx.close();
  }

  // ========== 6. REDIRECT: logged-in user hits /login or /register ==========
  console.log('\n--- Redirect logged-in user away from /login and /register ---');
  {
    const { sessionValue } = await createSessionCookie();
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    if (sessionValue) await ctx.addCookies([{ name: 'session', value: sessionValue, url: BASE }]);
    const page = await ctx.newPage();

    // /login
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await delay(1500);
    const loginUrl = page.url();
    log('[Redirect] /login → /dashboard', loginUrl.includes('/dashboard'), loginUrl);

    // /register
    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
    await delay(1500);
    const regUrl = page.url();
    log('[Redirect] /register → /dashboard', regUrl.includes('/dashboard'), regUrl);

    await page.screenshot({ path: `${SHOT_DIR}/redirect-dashboard.png` });
    console.log('    Screenshot: redirect-dashboard.png');
    await ctx.close();
  }

  await browser.close();

  console.log(`\n══════════════════════════════════`);
  console.log(`=== HEADER/AUTH VERIFICATION RESULTS ===`);
  console.log(`  ✅ ${passed} passed, ❌ ${failed} failed`);
  if (failed) console.log(`  Failed: ${failures.join(', ')}`);
  console.log(`========================================`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
