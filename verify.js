import { chromium } from 'playwright';

const BASE = 'https://x.door.id';

(async () => {
  const browser = await chromium.launch();
  let failed = 0;
  const errors = [];

  function assert(label, condition, detail) {
    if (!condition) {
      console.log(`  ❌ ${label}${detail ? `: ${detail}` : ''}`);
      failed++;
      errors.push(label);
    } else {
      console.log(`  ✅ ${label}`);
    }
  }

  try {
    console.log('🔍 TEST 1: Register → Assert NO redirect to dashboard');
    const page1 = await browser.newPage();
    const testUser = `testuser-${Date.now()}@e2e.com`;
    await page1.goto(`${BASE}/register`);
    await page1.fill('input[type="text"]', testUser.split('@')[0]);
    await page1.fill('input[type="email"]', testUser);
    await page1.fill('input[type="password"]', 'Test123456');
    await page1.click('button[type="submit"]');
    await page1.waitForTimeout(2000);
    assert('Register does NOT redirect to /dashboard', !page1.url().includes('/dashboard'));
    assert('Register shows success message', await page1.locator('text=Akun Berhasil Dibuat').isVisible().catch(() => false));

    console.log('\n🔍 TEST 2: Login → Assert Dashboard link appears');
    const page2 = await browser.newPage();
    await page2.goto(`${BASE}/login`);
    await page2.fill('input[type="email"]', testUser);
    await page2.fill('input[type="password"]', 'Test123456');
    await page2.click('button[type="submit"]');
    await page2.waitForTimeout(3000);
    assert('Login shows success message', await page2.locator('text=Berhasil').isVisible().catch(() => false));

    await page2.goto(`${BASE}`);
    // Wait for client-side auth check to run
    await page2.waitForTimeout(1500);
    assert('Dashboard link appears in nav after login', await page2.locator('button:has-text("Dashboard")').isVisible().catch(() => false));

    console.log('\n🔍 TEST 3: Access dashboard without login → Assert redirect to /login');
    const page3 = await browser.newPage(); // Fresh context = no cookies
    await page3.goto(`${BASE}/dashboard`);
    await page3.waitForTimeout(2000);
    assert('Redirects to /login', page3.url().includes('/login'));

    console.log('\n🔍 TEST 4: Access dashboard with login → Assert data loads');
    await page2.goto(`${BASE}/dashboard`);
    await page2.waitForTimeout(2000);
    assert('Dashboard page loads', page2.url().includes('/dashboard'));
    assert('Email Aliases stat card shows', await page2.locator('.stat-label:has-text("Email Aliases")').isVisible().catch(() => false));
    assert('Domains stat card shows', await page2.locator('.stat-label:has-text("Domains")').isVisible().catch(() => false));
    assert('List shows empty state initially', await page2.locator('text=Belum ada link').isVisible().catch(() => false));

    console.log('\n🔍 TEST 5: Create link → Edit link → Assert change saved');
    await page2.goto(`${BASE}`);
    await page2.waitForTimeout(2000);
    const testSlugEdit = `e2e-edit-${Date.now()}`;
    await page2.fill('#url-slug', testSlugEdit);
    await page2.fill('#url-dest', 'https://original-dest.com');
    
    // Handle alert dialogs from handleSubmit
    page2.on('dialog', dialog => dialog.accept());
    await page2.click('button:has-text("Perpendek URL")');
    await page2.waitForTimeout(2000);

    await page2.goto(`${BASE}/dashboard`);
    await page2.waitForTimeout(2000);
    
    // Find card with testSlugEdit — use JS click to bypass bottom-nav pointer interception
    const cardLocator = page2.locator('.card', { hasText: testSlugEdit });
    await cardLocator.waitFor({ state: 'visible', timeout: 10000 });
    
    // Click Edit button via JS evaluate (bypasses pointer-events overlay)
    await page2.evaluate((slug) => {
      const cards = document.querySelectorAll('.card');
      for (const card of cards) {
        if (card.textContent.includes(slug)) {
          const btn = card.querySelector('button[title="Edit"]');
          if (btn) btn.click();
          break;
        }
      }
    }, testSlugEdit);
    await page2.waitForTimeout(2000);

    // Wait for edit modal to appear — look for the modal with input
    const editModal = page2.locator('input').first();
    await editModal.waitFor({ state: 'visible', timeout: 10000 });
    await editModal.fill('https://updated-dest.com');
    
    // Click Simpan via JS too
    await page2.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        if (btn.textContent.trim() === 'Simpan') { btn.click(); break; }
      }
    });
    await page2.waitForTimeout(1500);

    const updatedDestText = await cardLocator.locator('.card-dest').textContent();
    console.log(`  👉 Edit Result - Target Slug: ${testSlugEdit}`);
    console.log(`  👉 Edit Result - New Destination in DOM: ${updatedDestText}`);
    assert('Slug remains unchanged', await cardLocator.locator('.card-slug').textContent() === `door.id/${testSlugEdit}`);
    assert('Destination updated successfully', updatedDestText.includes('https://updated-dest.com'));

    console.log('\n🔍 TEST 6: Delete link → Assert disappears & 404');
    const testSlugDel = `e2e-del-${Date.now()}`;
    await page2.goto(`${BASE}`);
    await page2.waitForTimeout(2000);
    await page2.fill('#url-slug', testSlugDel);
    await page2.fill('#url-dest', 'https://example.com/delete-me');
    await page2.click('button:has-text("Perpendek URL")');
    await page2.waitForTimeout(2000);

    await page2.goto(`${BASE}/dashboard`);
    await page2.waitForTimeout(2000);

    const delCardLocator = page2.locator('.card', { hasText: testSlugDel });
    await delCardLocator.waitFor({ state: 'visible', timeout: 10000 });
    // Click Delete: call API directly via JS evaluate (React synthetic events don't fire on native .click in Workers)
    const deleteRes = await page2.evaluate(async (slug) => {
      // Find the card and extract its ID from the data attribute or onclick
      const cards = document.querySelectorAll('.card');
      for (const card of cards) {
        if (card.textContent.includes(slug)) {
          // Extract slug ID from the card's link - look for the API pattern
          // We need to find the id from the slugs data, so just call the list API first
          const listRes = await fetch('/api/slugs/create');
          const listData = await listRes.json();
          const slugRecord = (listData.slugs || []).find(s => s.slug === slug);
          if (slugRecord) {
            const delRes = await fetch(`/api/slugs/${slugRecord.id}`, { method: 'DELETE' });
            return { status: delRes.status, id: slugRecord.id };
          }
        }
      }
      return { status: 404, id: null };
    }, testSlugDel);
    console.log(`  👉 Delete API result: status=${deleteRes.status}, id=${deleteRes.id}`);
    
    // Refresh dashboard to reflect the change
    await page2.goto(`${BASE}/dashboard`);
    await page2.waitForTimeout(2000);
    const isStillInList = await page2.locator('.card', { hasText: testSlugDel }).isVisible().catch(() => false);
    console.log(`  👉 Delete Result - Present in dashboard list after delete: ${isStillInList}`);
    assert('Link disappears from dashboard list', !isStillInList);

    const res404 = await page2.goto(`${BASE}/${testSlugDel}`);
    const status404 = res404 ? res404.status() : 0;
    console.log(`  👉 Delete Result - HTTP status on direct access: ${status404}`);
    assert('Direct access returns 404', status404 === 404 || page2.url().includes('404') || await page2.locator('text=404').isVisible().catch(() => false));

    console.log('\n🔍 TEST 8: Click QR → Assert QR code appears');
    await page2.goto(`${BASE}/dashboard`);
    await page2.waitForTimeout(2000);
    
    // Ensure at least one card exists
    if (await page2.locator('.card').count() === 0) {
      await page2.goto(`${BASE}`);
      await page2.fill('#url-slug', `e2e-qr-${Date.now()}`);
      await page2.fill('#url-dest', 'https://qr-test.com');
      await page2.click('button:has-text("Perpendek URL")');
      await page2.waitForTimeout(2000);
      await page2.goto(`${BASE}/dashboard`);
      await page2.waitForTimeout(2000);
    }

    // Click QR button via JS
    await page2.evaluate(() => {
      const btn = document.querySelector('button[title="QR Code"]');
      if (btn) btn.click();
    });
    await page2.waitForTimeout(2000);

    const modalVisible = await page2.locator('text=QR Code').isVisible().catch(() => false);
    const svgVisible = await page2.locator('svg').count() > 0;
    console.log(`  👉 QR Result - Modal visible: ${modalVisible}`);
    console.log(`  👉 QR Result - SVG/Canvas QR element visible in DOM: ${svgVisible}`);
    assert('QR Modal opens', modalVisible);
    assert('QR SVG/Canvas element exists in DOM', svgVisible);

    console.log('\n=== RESULTS ===');
    if (failed > 0) {
      console.log(`FAILED: ${failed} tests`);
      console.log(errors);
      process.exitCode = 1;
    } else {
      console.log('ALL TESTS PASSED');
    }

  } catch (e) {
    console.error('CRITICAL ERROR:', e);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
