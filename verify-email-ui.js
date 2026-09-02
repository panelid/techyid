const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'https://door-of-cloudflare.dalil.workers.dev';
const EMAIL = 'e2e-door@test.local';
const PASS = 'Test1234!';

(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERR: ' + e.message));

  try {
    // Login via API + cookie
    const loginRes = await page.request.post(`${BASE}/api/auth/login`, {
      headers: { 'Content-Type': 'application/json', 'x-ci-test': 'true' },
      data: { email: EMAIL, password: PASS },
    });
    console.log('login api:', loginRes.status(), (await loginRes.json()).success !== undefined ? 'ok' : '');
    const ck = loginRes.headers()['set-cookie'].split(';')[0];
    if (ck) {
      const eq = ck.indexOf('=');
      await context.addCookies([{ name: ck.slice(0, eq), value: ck.slice(eq + 1), url: BASE }]);
    }

    await page.goto(`${BASE}/dashboard/email`, { waitUntil: 'networkidle' });
    console.log('after login url:', page.url());

    // ── INBOX ──
    console.log('=== INBOX ===');
    await page.waitForSelector('[data-testid="inbox-item"]', { timeout: 10000 });
    console.log('inbox item visible:', (await page.locator('[data-testid="inbox-item"]').count()) > 0);
    await page.locator('[data-testid="inbox-item"]').first().click();
    await page.waitForTimeout(800);
    console.log('inbox detail body shows:', (await page.locator('text=Halo ini isi pesan masuk dari luar').count()) > 0);

    const delInboxCount = await page.locator('[data-testid="inbox-item"] button[aria-label="Hapus pesan masuk"]').count();
    console.log('inbox delete btn found:', delInboxCount > 0);
    page.once('dialog', d => d.accept());
    await page.locator('[data-testid="inbox-item"] button[aria-label="Hapus pesan masuk"]').first().click();
    await page.waitForTimeout(1500);
    console.log('inbox after delete (should be 0):', await page.locator('text=Pesan Masuk Test').count());

    // ── SENT ──
    console.log('=== SENT ===');
    await page.getByText('📤 Terkirim').click();
    await page.waitForSelector('[data-testid="sent-item"]', { timeout: 10000 });
    console.log('sent item visible:', (await page.locator('[data-testid="sent-item"]').count()) > 0);
    await page.locator('[data-testid="sent-item"]').first().click();
    await page.waitForTimeout(800);
    console.log('sent detail body shows:', (await page.locator('text=Halo ini isi email terkirim').count()) > 0);

    const delSentCount = await page.locator('[data-testid="sent-item"] button[aria-label="Hapus email terkirim"]').count();
    console.log('sent delete btn found:', delSentCount > 0);
    page.once('dialog', d => d.accept());
    await page.locator('[data-testid="sent-item"] button[aria-label="Hapus email terkirim"]').first().click();
    await page.waitForTimeout(1500);
    console.log('sent after delete (should be 0):', await page.locator('text=Email Terkirim Test').count());

    console.log('CONSOLE_ERRORS:', errors.length, errors.slice(0,3));
    console.log('E2E_RESULT: PASS');
  } catch (e) {
    console.log('FATAL', e.message);
    console.log('CONSOLE_ERRORS:', errors.slice(0,5));
    console.log('E2E_RESULT: FAIL');
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
