const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const BASE = process.env.BASE_URL || 'https://x.door.id';
const slug = `ci-${Date.now().toString(36)}`;
const target = `https://example.com/?door=${slug}`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  const created = await page.evaluate(async ({ slug, target }) => {
    const res = await fetch('/api/slugs/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ci-test': 'true' },
      body: JSON.stringify({ slug, type: 'url', data: { url: target } }),
    });
    return { status: res.status, body: await res.json() };
  }, { slug, target });
  assert.equal(created.status, 201);
  assert.equal(created.body.success, true);
  assert.equal(created.body.slug.slug, slug);
  assert.equal(created.body.slug.type, 'url');

  const redirect = await page.goto(`${BASE}/${slug}`, { waitUntil: 'domcontentloaded' });
  assert.ok(redirect);
  assert.equal(redirect.status(), 200);
  assert.match(page.url(), new RegExp(`^${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  await browser.close();
  console.log(JSON.stringify({ slug, target, createStatus: created.status, finalUrl: page.url() }));
})().catch(async (e) => { console.error(e); process.exit(1); });
