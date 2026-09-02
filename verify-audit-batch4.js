// verify-audit-batch4.js — Comprehensive E2E tests for E-4, E-5, U-1, U-2, U-5, P-1
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'https://x.door.id';

async function runTests() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const results = [];

  function log(test, passed, detail) {
    const icon = passed ? '✅' : '❌';
    console.log(`  ${icon} ${test}${detail ? ' — ' + detail : ''}`);
    results.push({ test, passed, detail });
  }

  const delay = (ms) => new Promise(r => setTimeout(r, ms));

  // Helper to register & login test user
  const email = `audit-${Date.now()}@test.com`;
  const regRes = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'AuditPass123!' }),
    redirect: 'manual',
  });
  const setCookie = regRes.headers.get('set-cookie') || '';
  const sessionToken = setCookie.match(/session=([^;]+)/)?.[1];
  const cookieHeader = sessionToken ? `session=${sessionToken}` : '';
  console.log(`🔑 Test user registered: ${regRes.status}, token: ${sessionToken ? 'yes' : 'no'}`);

  // Helper to create a slug with retry for rate limiting
  async function createSlug(slug, url) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await fetch(`${BASE}/api/slugs/create`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Cookie': cookieHeader,
          'x-ci-test': 'true'
        },
        body: JSON.stringify({ slug, type: 'url', data: { url } }),
      });
      if (res.status === 429) {
        console.log(`    Rate limited on ${slug}, waiting 2s...`);
        await delay(2000);
        continue;
      }
      return { status: res.status, body: await res.json() };
    }
    return { status: 429, body: { error: 'rate limited' } };
  }

  // ─────────────────────────────────────────────────────────────
  // [E-4] Pagination Test
  // ─────────────────────────────────────────────────────────────
  console.log('\n🔍 [E-4] Testing Pagination (Create 55 links, test page=1 and page=2)...');
  try {
    const batchId = Date.now();
    let created = 0;
    for (let i = 1; i <= 55; i++) {
      const slug = `p4g${batchId}${i}`;
      const result = await createSlug(slug, `https://example.com/${i}`);
      if (result.status === 201 || result.status === 200) created++;
      if (i % 10 === 0) console.log(`    Created ${i}/55 slugs...`);
      await delay(150); // Avoid rate limiting
    }
    console.log(`    Total created: ${created}/55`);

    await delay(1000); // Let D1 settle

    // Fetch page 1
    const res1 = await fetch(`${BASE}/api/slugs/create?page=1`, {
      headers: { 'Cookie': cookieHeader, 'x-ci-test': 'true' },
    });
    const text1 = await res1.text();
    console.log(`    Page 1 raw response (first 300 chars): ${text1.substring(0, 300)}`);
    let data1;
    try {
      data1 = JSON.parse(text1);
    } catch {
      throw new Error(`Failed to parse JSON for page 1: ${text1.substring(0, 100)}`);
    }
    console.log(`    Page 1: status ${res1.status}, slugs count: ${data1.slugs?.length}, total: ${data1.total}, totalPages: ${data1.totalPages}`);
    
    const page1Valid = data1.slugs?.length === 50 && data1.total >= 55 && data1.totalPages >= 2;
    log('[E-4] Page 1 returns 50 items and totalPages >= 2', page1Valid, `slugs=${data1.slugs?.length}, totalPages=${data1.totalPages}`);

    // Fetch page 2
    const res2 = await fetch(`${BASE}/api/slugs/create?page=2`, {
      headers: { 'Cookie': cookieHeader, 'x-ci-test': 'true' }
    });
    const text2 = await res2.text();
    let data2;
    try {
      data2 = JSON.parse(text2);
    } catch {
      throw new Error(`Failed to parse JSON for page 2: ${text2.substring(0, 100)}`);
    }
    console.log(`    Page 2: status ${res2.status}, slugs count: ${data2.slugs?.length}`);
    const page2Valid = data2.slugs?.length > 0 && data2.slugs?.length <= 50;
    log('[E-4] Page 2 returns remaining items', page2Valid, `slugs=${data2.slugs?.length}`);
  } catch (e) {
    log('[E-4] Pagination test', false, e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // [E-5] Bot Detection Click Count Test
  // ─────────────────────────────────────────────────────────────
  console.log('\n🔍 [E-5] Testing Bot Detection & Click Count...');
  try {
    const slug = `botest-${Date.now()}`;
    const createResult = await createSlug(slug, 'https://example.com/dest');
    console.log(`    Created slug: ${createResult.status}`);
    await delay(500);

    // 1. Hit with Googlebot User-Agent
    const botRes = await fetch(`${BASE}/${slug}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
      redirect: 'manual'
    });
    console.log(`    Bot request status: ${botRes.status}`);

    await delay(1000);

    // Check click count via API list
    const listRes1 = await fetch(`${BASE}/api/slugs/create?page=1`, { 
      headers: { 'Cookie': cookieHeader, 'x-ci-test': 'true' } 
    });
    const listData1 = await listRes1.json();
    const record1 = listData1.slugs?.find((s) => s.slug === slug);
    console.log(`    Click count after Bot: ${record1?.click_count}`);
    const botSkipped = record1?.click_count === 0;
    log('[E-5] Bot (Googlebot) does NOT increment click_count', botSkipped, `click_count=${record1?.click_count}`);

    // 2. Hit with Normal Browser User-Agent
    const normalRes = await fetch(`${BASE}/${slug}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' },
      redirect: 'manual'
    });
    console.log(`    Normal request status: ${normalRes.status}`);
    const normalText = await normalRes.text();
    console.log(`    Normal response length: ${normalText.length}`);

    await delay(3000); // Wait longer for D1 UPDATE to propagate

    const listRes2 = await fetch(`${BASE}/api/slugs/create?page=1`, { 
      headers: { 'Cookie': cookieHeader, 'x-ci-test': 'true' } 
    });
    const listData2 = await listRes2.json();
    const record2 = listData2.slugs?.find((s) => s.slug === slug);
    console.log(`    Click count after Normal user: ${record2?.click_count}`);
    const normalIncremented = record2?.click_count === 1;
    log('[E-5] Normal browser increments click_count', normalIncremented, `click_count=${record2?.click_count}`);
  } catch (e) {
    log('[E-5] Bot detection test', false, e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // [U-1] Copy-to-Clipboard Modal UI Test
  // ─────────────────────────────────────────────────────────────
  console.log('\n🔍 [U-1] Testing Copy-to-Clipboard Modal & UI...');
  const page = await browser.newPage();
  try {
    // Intercept API calls to add x-ci-test header (avoids 429 rate limit)
    await page.route('**/api/**', async (route) => {
      const headers = await route.request().allHeaders();
      headers['x-ci-test'] = 'true';
      await route.continue({ headers });
    });

    // Inject session cookie so slug creation doesn't redirect to /register
    if (sessionToken) {
      await context.addCookies([{ name: 'session', value: sessionToken, url: BASE }]);
    }
    await page.goto(`${BASE}`);
    await delay(1000);
    
    // Fill short url form
    await page.fill('input[id="url-slug"]', `copytst-${Date.now()}`);
    await page.fill('input[id="url-dest"]', 'https://example.com/copy');
    
    // Log form state before submit
    const slugVal = await page.inputValue('input[id="url-slug"]');
    const destVal = await page.inputValue('input[id="url-dest"]');
    console.log(`    Form filled: slug=${slugVal}, dest=${destVal}`);

    await page.click('button:has-text("Shorten URL"), button:has-text("Perpendek URL")');
    
    // Watch for the API response
    page.on('response', (res) => {
      if (res.url().includes('/api/slugs/create')) {
        console.log(`    API response: ${res.status()}`);
      }
    });
    
    await page.waitForTimeout(3000);

    // Wait for modal to appear
    await page.waitForSelector('text=Link Berhasil Dibuat', { state: 'visible', timeout: 5000 }).catch(() => null);
    
    // Check if success modal is visible
    const modalVisible = await page.locator('text=Link Berhasil Dibuat').isVisible().catch(() => false);
    const copyBtnExists = await page.locator('button:has-text("Copy Link")').isVisible().catch(() => false);
    console.log(`    Modal visible: ${modalVisible}, Copy button exists: ${copyBtnExists}`);
    log('[U-1] Success modal appears with Copy Link button', modalVisible && copyBtnExists);
  } catch (e) {
    log('[U-1] Copy-to-clipboard modal test', false, e.message);
  }
  await page.close();

  // ─────────────────────────────────────────────────────────────
  // [U-5] Password Strength Validation Test
  // ─────────────────────────────────────────────────────────────
  console.log('\n🔍 [U-5] Testing Password Strength Validation...');
  try {
    // 1. Weak password ("abc") → assert 400
    const weakRes = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `weak-${Date.now()}@test.com`, password: 'abc' })
    });
    const weakBody = await weakRes.json();
    console.log(`    Weak password response: HTTP ${weakRes.status}, body: ${JSON.stringify(weakBody)}`);
    log('[U-5] Weak password ("abc") rejected with 400', weakRes.status === 400, `HTTP ${weakRes.status}, error: "${weakBody.error}"`);

    // 2. Strong password ("Passw0rd123") → assert success
    const strongRes = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `strong-${Date.now()}@test.com`, password: 'Passw0rd123' })
    });
    const strongBody = await strongRes.json();
    console.log(`    Strong password response: HTTP ${strongRes.status}, body: ${JSON.stringify(strongBody)}`);
    log('[U-5] Strong password ("Passw0rd123") accepted with success', strongRes.status === 200 && strongBody.success, `HTTP ${strongRes.status}`);
  } catch (e) {
    log('[U-5] Password strength test', false, e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // [P-1] KV Caching Consistency Test
  // ─────────────────────────────────────────────────────────────
  console.log('\n🔍 [P-1] Testing KV Caching Consistency (Create -> Redirect -> Edit -> Invalidate -> Delete -> 404)...');
  try {
    const slug = `kvtest-${Date.now()}`;
    // 1. Create link
    const createResult = await createSlug(slug, 'https://example.com/v1');
    console.log(`    Created link status: ${createResult.status}`);
    const linkId = createResult.body?.slug?.id;
    console.log(`    Created link ID: ${linkId}`);
    
    if (!linkId) {
      throw new Error('Failed to create link: ' + JSON.stringify(createResult.body));
    }
    
    await delay(500);

    // a. Assert redirect works immediately
    const redir1 = await fetch(`${BASE}/${slug}`, { 
      redirect: 'manual', 
      headers: { 'User-Agent': 'TestClient' } 
    });
    console.log(`    Redirect v1 status: ${redir1.status}, location: ${redir1.headers.get('location')}`);
    const v1Ok = redir1.status === 307 && redir1.headers.get('location') === 'https://example.com/v1';
    log('[P-1a] Initial redirect works correctly', v1Ok, `location=${redir1.headers.get('location')}`);

    // 2. Edit link destination to v2 via PATCH
    const patchRes = await fetch(`${BASE}/api/slugs/${linkId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
      body: JSON.stringify({ data: { url: 'https://example.com/v2' } })
    });
    console.log(`    PATCH status: ${patchRes.status}`);
    
    await delay(3000); // Wait for KV write-through to propagate

    // b. Assert redirect immediately reflects new URL
    const redir2 = await fetch(`${BASE}/${slug}`, { 
      redirect: 'manual', 
      headers: { 'User-Agent': 'TestClient' } 
    });
    console.log(`    Redirect v2 status: ${redir2.status}, location: ${redir2.headers.get('location')}`);
    const v2Ok = redir2.status === 307 && redir2.headers.get('location') === 'https://example.com/v2';
    log('[P-1b] Edited redirect immediately reflects new URL (KV cache invalidated/updated)', v2Ok, `location=${redir2.headers.get('location')}`);

    // 3. Delete link via DELETE
    const delRes = await fetch(`${BASE}/api/slugs/${linkId}`, {
      method: 'DELETE',
      headers: { 'Cookie': cookieHeader }
    });
    console.log(`    DELETE status: ${delRes.status}`);
    
    await delay(3000); // Wait for KV delete to propagate

    // c. Assert redirect returns 404
    const redir3 = await fetch(`${BASE}/${slug}`, { 
      redirect: 'manual', 
      headers: { 'User-Agent': 'TestClient' } 
    });
    console.log(`    Redirect after delete status: ${redir3.status}`);
    const notFoundOk = redir3.status === 404;
    log('[P-1c] Deleted slug immediately returns 404 (KV cache evicted)', notFoundOk, `HTTP ${redir3.status}`);

  } catch (e) {
    log('[P-1] KV caching test', false, e.message);
  }

  await browser.close();

  // ──── SUMMARY ────
  console.log('\n══════════════════════════════════════════════');
  console.log('=== BATCH 4 AUDIT FIXES TEST RESULTS ===');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  for (const r of results) {
    console.log(`  ${r.passed ? '✅' : '❌'} ${r.test}${r.detail ? ' — ' + r.detail : ''}`);
  }
  console.log(`\n${passed}/${total} assertions passed`);
  if (passed === total) {
    console.log('ALL BATCH 4 TESTS PASSED');
    process.exit(0);
  } else {
    console.log('SOME BATCH 4 TESTS FAILED');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test script execution error:', err);
  process.exit(1);
});
