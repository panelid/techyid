// verify-security.js — 5 security-specific E2E tests
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'https://x.door.id';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const results = [];

  function log(test, result, detail) {
    const icon = result ? '✅' : '❌';
    console.log(`  ${icon} ${test}${detail ? ': ' + detail : ''}`);
    results.push({ test, result, detail });
  }

  // ─────────────────────────────────────────────
  // TEST 1: Rate limiting — 6x failed login → 429
  // ─────────────────────────────────────────────
  console.log('\n🔍 TEST 1: Rate Limiting — 6x failed login → assert 429 on #6');
  try {
    let got429 = false;
    for (let i = 1; i <= 6; i++) {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `ratelim-${Date.now()}@test.com`, password: 'wrongpass' }),
      });
      console.log(`    Attempt ${i}: HTTP ${res.status}`);
      if (i === 6 && res.status === 429) {
        got429 = true;
        const body = await res.json();
        console.log(`    429 body: ${JSON.stringify(body)}`);
      }
    }
    log('Rate limit triggers 429 after 5 failed attempts', got429, got429 ? 'HTTP 429 received on attempt #6' : 'No 429 received');
  } catch (e) {
    log('Rate limit test', false, e.message);
  }

  // ─────────────────────────────────────────────
  // TEST 2: Paste with password — correct & wrong
  // ─────────────────────────────────────────────
  console.log('\n🔍 TEST 2: Paste password — correct + wrong verification');
  const page = await browser.newPage();
  try {
    const slug = `secpaste-${Date.now()}`;

    // Create paste with password
    const createRes = await fetch(`${BASE}/api/paste`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ slug, content: 'Secret paste content for security test', password: 'MyStr0ngP@ss!' }),
    });
    const createBody = await createRes.json();
    console.log(`    Create paste: ${createRes.status}, slug: ${slug}`);
    log('Paste with password created', createRes.status === 201, `HTTP ${createRes.status}`);

    // Visit paste page — should show password gate
    await page.goto(`${BASE}/${slug}`);
    await page.waitForTimeout(2000);
    const hasLockIcon = await page.locator('text=🔒').count() > 0 || await page.locator('text=Terenkripsi').count() > 0;
    console.log(`    Password gate visible: ${hasLockIcon}`);
    log('Paste shows password gate', hasLockIcon);

    // Wrong password
    await page.fill('input[type="password"]', 'WrongPassword123');
    await page.click('button:has-text("Buka")');
    await page.waitForTimeout(2000);
    const hasError = await page.locator('text=salah').count() > 0 || await page.locator('text=Invalid').count() > 0 || await page.locator('[data-testid="paste-error"]').count() > 0;
    console.log(`    Wrong password shows error: ${hasError}`);
    log('Wrong password rejected', hasError);

    // Correct password
    await page.fill('input[type="password"]', '');
    await page.fill('input[type="password"]', 'MyStr0ngP@ss!');
    await page.click('button:has-text("Buka")');
    await page.waitForTimeout(2000);
    const contentVisible = await page.locator('text=Secret paste content').count() > 0;
    console.log(`    Correct password shows content: ${contentVisible}`);
    log('Correct password reveals content', contentVisible);
  } catch (e) {
    log('Paste password test', false, e.message);
  }
  await page.close();

  // ─────────────────────────────────────────────
  // TEST 3: Duplicate slug → 409
  // ─────────────────────────────────────────────
  console.log('\n🔍 TEST 3: Duplicate slug → assert 409');
  try {
    const slug = `dupslug-${Date.now()}`;
    const payload = { slug, type: 'url', data: { url: 'https://example.com' } };
    const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) };

    const first = await fetch(`${BASE}/api/slugs/create`, opts);
    console.log(`    First create: HTTP ${first.status}`);
    log('First slug creation succeeds', first.status === 201, `HTTP ${first.status}`);

    const dupe = await fetch(`${BASE}/api/slugs/create`, opts);
    const dupeBody = await dupe.json();
    console.log(`    Duplicate create: HTTP ${dupe.status}, body: ${JSON.stringify(dupeBody)}`);
    log('Duplicate slug returns 409', dupe.status === 409, `HTTP ${dupe.status}`);
    log('Error message mentions "sudah dipakai"', dupeBody.error?.includes('sudah dipakai') || dupeBody.error?.includes('taken'), `"${dupeBody.error}"`);
  } catch (e) {
    log('Duplicate slug test', false, e.message);
  }

  // ─────────────────────────────────────────────
  // TEST 4: Logout → session invalidation → 401
  // ─────────────────────────────────────────────
  console.log('\n🔍 TEST 4: Logout → session invalidation → 401');
  try {
    // Register + login to get session cookie
    const email = `logout-${Date.now()}@test.com`;
    const regRes = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'LogoutTest123!' }),
    });
    const regSetCookie = regRes.headers.get('set-cookie') || '';
    const sessionToken = regSetCookie.match(/session=([^;]+)/)?.[1];
    console.log(`    Registered: ${regRes.status}, token: ${sessionToken ? 'yes' : 'no'}`);
    log('Registration succeeds', regRes.status === 200, `HTTP ${regRes.status}`);

    // Verify session works
    const sessionRes = await fetch(`${BASE}/api/auth/session`, {
      headers: { Cookie: `session=${sessionToken}` },
    });
    console.log(`    Session check: HTTP ${sessionRes.status}`);
    log('Session valid before logout', sessionRes.status === 200, `HTTP ${sessionRes.status}`);

    // Logout
    const logoutRes = await fetch(`${BASE}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: `session=${sessionToken}` },
    });
    console.log(`    Logout: HTTP ${logoutRes.status}`);
    log('Logout succeeds', logoutRes.status === 200, `HTTP ${logoutRes.status}`);

    // Try accessing protected endpoint with old session
    const afterLogout = await fetch(`${BASE}/api/slugs/create`, {
      headers: { Cookie: `session=${sessionToken}` },
    });
    console.log(`    Session after logout: HTTP ${afterLogout.status}`);
    log('Session invalidated after logout (401)', afterLogout.status === 401, `HTTP ${afterLogout.status}`);
  } catch (e) {
    log('Logout session invalidation test', false, e.message);
  }

  // ─────────────────────────────────────────────
  // TEST 5: Paste > 100KB → 400
  // ─────────────────────────────────────────────
  console.log('\n🔍 TEST 5: Paste > 100KB content → assert 400');
  try {
    const slug = `bigpaste-${Date.now()}`;
    // Generate ~150KB content
    const bigContent = 'x'.repeat(150 * 1024);
    const res = await fetch(`${BASE}/api/paste`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ slug, content: bigContent }),
    });
    const body = await res.json();
    console.log(`    HTTP ${res.status}, body: ${JSON.stringify(body)}`);
    log('Oversized paste rejected with 400', res.status === 400, `HTTP ${res.status}`);
    log('Error mentions size/KB', body.error?.includes('KB') || body.error?.includes('besar') || body.error?.includes('100'), `"${body.error}"`);
  } catch (e) {
    log('Paste size limit test', false, e.message);
  }

  await browser.close();

  // ──── SUMMARY ────
  console.log('\n══════════════════════════════════════');
  console.log('=== SECURITY TEST RESULTS ===');
  const passed = results.filter(r => r.result).length;
  const total = results.length;
  for (const r of results) {
    console.log(`  ${r.result ? '✅' : '❌'} ${r.test}${r.detail ? ' — ' + r.detail : ''}`);
  }
  console.log(`\n${passed}/${total} assertions passed`);
  if (passed === total) console.log('ALL SECURITY TESTS PASSED');
  else console.log('SOME TESTS FAILED');
})();
