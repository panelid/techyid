const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Navigating to https://x.door.id/github...");
  
  try {
    const response = await page.goto('https://x.door.id/github', {
      waitUntil: 'networkidle',
      timeout: 10000
    });
    
    console.log("Response URL:", page.url());
    console.log("Status:", response.status());
    
    // Take screenshot
    await page.screenshot({ path: 'redirect-test.png' });
    console.log("Screenshot saved as redirect-test.png");
    
    const body = await page.evaluate(() => document.body.innerText);
    console.log("Page text body first 200 chars:", body.substring(0, 200));

  } catch (error) {
    console.error("Navigation error:", error.message);
  } finally {
    await browser.close();
  }
}

run();
