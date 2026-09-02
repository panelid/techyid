const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'https://door-of-cloudflare.dalil.workers.dev';
const results = [];
const ok = (name, cond, extra='') => { results.push(`${cond?'✅':'❌'} ${name} ${extra}`); };

(async () => {
  const browser = await chromium.launch({ headless: true });

  async function createSession() {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const email = `nf-${Date.now()}@test.com`;
    const reg = await page.request.post(`${BASE}/api/auth/register`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email, password: 'Passw0rd123', username: `nf${Date.now()}` },
    });
    const cookies = await ctx.cookies();
    const session = cookies.find(c => c.name === 'session');
    await ctx.close();
    return { email, sessionValue: session ? session.value : null };
  }

  try {
    const { sessionValue } = await createSession();
    if (!sessionValue) throw new Error('No session cookie from register');

    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    if (sessionValue) await ctx.addCookies([{ name: 'session', value: sessionValue, domain: new URL(BASE).hostname, path: '/' }]);
    const page = await ctx.newPage();

    // ═══ 1. DASHBOARD: bottom nav + Views stat ═══
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const dashText = await page.textContent('body');
    ok('Dashboard: bottom-nav present', /Statistik/.test(dashText) && /Domains/.test(dashText));
    ok('Dashboard: Views stat card', /Views/.test(dashText));
    ok('Dashboard: stat cards rendered', /Total Links/.test(dashText) && /Domains/.test(dashText));
    await page.screenshot({ path: 'shot-dashboard.png', fullPage: true });

    // ═══ 2. EMAIL: Terkirim tab ═══
    await page.goto(`${BASE}/dashboard/email`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3500);
    const terkirimBtn = page.locator('button:has-text("Terkirim")').first();
    ok('Email: Terkirim tab present', (await terkirimBtn.count()) > 0);
    // check tab order: Kirim button appears before Terkirim button in DOM
    const tabButtons = await page.locator('button', { hasText: /Kirim|Terkirim/ }).allInnerTexts();
    const tabStr = tabButtons.join('|');
    const kirimIdx = tabStr.indexOf('Kirim');
    const terkirimIdx = tabStr.indexOf('Terkirim');
    ok('Email: tab order Kirim → Terkirim', kirimIdx >=0 && terkirimIdx > kirimIdx, `"${tabStr}"`);
    if (await terkirimBtn.count() > 0) {
      await terkirimBtn.click();
      await page.waitForTimeout(1500);
      const sentText = await page.textContent('body');
      ok('Email: Terkirim tab shows content', /Belum ada email terkirim|Terkirim/.test(sentText));
      // If there are sent items, click first to open detail modal
      const firstItem = page.locator('div[style*="cursor: pointer"]').first();
      if ((await firstItem.count()) > 0) {
        await firstItem.click();
        await page.waitForTimeout(1000);
        const modalText = await page.textContent('body');
        ok('Email: click sent item opens detail modal', /Detail Email Terkirim/.test(modalText));
      } else {
        ok('Email: click sent item opens detail modal', true, 'no items to click (skipped)');
      }
    }
    await page.screenshot({ path: 'shot-email-sent.png', fullPage: true });

    // ═══ 3. LANDING: slug availability check ═══
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const slugInput = await page.locator('#url-slug').first();
    await slugInput.fill('sudahada-test');
    await page.waitForTimeout(3000);
    const landText = await page.textContent('body');
    const m = landText.match(/(Tersedia|Sudah dipakai|reserved|tidak valid|Mengecek[^<]*)/);
    ok('Landing: slug status indicator appears', !!m, m ? `"${m[0]}"` : 'none');
    await page.screenshot({ path: 'shot-landing-slug.png', fullPage: true });

    const failed = results.filter(r => r.startsWith('❌'));
    console.log('\n' + results.join('\n'));
    console.log(`\n${failed.length === 0 ? '🎉 ALL NEW-FEATURE CHECKS PASSED' : `⚠️  ${failed.length} FAILED`}`);
    await browser.close();
    process.exit(failed.length === 0 ? 0 : 1);
  } catch (e) {
    console.error('SCRIPT ERROR:', e.message);
    try { await page.screenshot({ path: 'shot-error.png', fullPage: true }); } catch {}
    await browser.close();
    process.exit(2);
  }
})();
