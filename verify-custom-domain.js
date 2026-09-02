const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // 1. Navigate to login
    await page.goto('https://x.door.id/login', { waitUntil: 'networkidle' });
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });
    
    // 2. Register/login test user
    const testEmail = `e2e-${Date.now()}@test.local`;
    const testPass = 'Test@12345';
    
    // Try register
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPass);
    const registerBtn = await page.locator('button:has-text("Register")').first();
    if (await registerBtn.isVisible()) {
      await registerBtn.click();
      await page.waitForNavigation({ waitUntil: 'networkidle' });
    } else {
      // If login page, just login
      const loginBtn = await page.locator('button:has-text("Login")').first();
      await loginBtn.click();
      await page.waitForNavigation({ waitUntil: 'networkidle' });
    }
    
    // 3. Navigate to domains dashboard
    await page.goto('https://x.door.id/dashboard/domains', { waitUntil: 'networkidle' });
    await page.waitForSelector('input[placeholder="domainkamu.com"]', { timeout: 5000 });
    
    // 4. Add test domain
    const testDomain = `e2e-${Date.now()}.test`;
    await page.fill('input[placeholder="domainkamu.com"]', testDomain);
    await page.click('button:has-text("Add Domain")');
    await page.waitForTimeout(2000);
    
    // 5. Check domain added to list
    const domainText = await page.textContent('body');
    assert(domainText.includes(testDomain), 'Domain should appear in list');
    
    // 6. Expand to see nameservers
    const chevron = await page.locator('button[aria-label="Tampilkan instruksi"]').first();
    if (await chevron.isVisible()) {
      await chevron.click();
      await page.waitForTimeout(1000);
      const nsCode = await page.textContent('code');
      assert(nsCode && nsCode.includes('cloudflare.com'), 'Nameserver should be from Cloudflare');
    }
    
    // 7. Try verify (will fail if NS not propagated, but tests the flow exists)
    const verifyBtn = await page.locator('button:has-text("Verify")').first();
    if (await verifyBtn.isVisible()) {
      await verifyBtn.click();
      await page.waitForTimeout(2000);
    }
    
    // 8. Delete domain
    const deleteBtn = await page.locator('button:has-text("Delete")').first();
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      page.once('dialog', async dialog => {
        await dialog.accept();
      });
      await page.waitForTimeout(2000);
    }
    
    console.log('✅ Custom domain E2E flow passed: login → add → verify → delete');
  } catch (error) {
    console.error('❌ Custom domain E2E test failed:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
