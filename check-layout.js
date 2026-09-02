// check-layout.js
// Playwright layout check: verify no horizontal overflow at desktop/tablet/mobile widths
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'https://x.door.id';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const contexts = [
    { name: 'Desktop', width: 1280, height: 800 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Mobile', width: 375, height: 667 },
  ];

  console.log(`🔍 Checking layout for ${BASE}...`);

  for (const c of contexts) {
    const ctx = await browser.newContext({ viewport: { width: c.width, height: c.height } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const metrics = await page.evaluate(() => ({
      docW: document.documentElement.scrollWidth,
      bodyW: document.body.scrollWidth,
      winW: window.innerWidth,
    }));
    const overflow = metrics.docW > metrics.winW || metrics.bodyW > metrics.winW;

    console.log(`\n--- ${c.name} (${c.width}x${c.height}) ---`);
    console.log(`   Overflow: ${overflow ? '❌ YES' : '✅ NO'}`);
    console.log(`   Widths: Doc ${metrics.docW}/${metrics.winW}, Body ${metrics.bodyW}/${metrics.winW}`);

    const shot = `layout-${c.name.toLowerCase()}.png`;
    await page.screenshot({ path: shot, fullPage: false });
    console.log(`   Screenshot saved: ${shot}`);
    await ctx.close();
  }

  await browser.close();
  console.log('\nLayout check complete.');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
