// verify-passkey-flow.js
// E2E regression test for passkey registration flow using mocked WebAuthn.
// Verifies client sends full JSON payload and UI surfaces success.

const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'https://x.door.id';

function b64urlFromBytes(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return Buffer.from(s, 'binary').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // Create session via existing login route
  const email = `pkflow-${Date.now()}@test.com`;
  const username = `pkflow${Date.now()}`;
  const reg = await page.request.post(`${BASE}/api/auth/register`, {
    headers: { 'Content-Type': 'application/json', 'x-ci-test': 'true' },
    data: { email, password: 'Passw0rd123', username },
  });
  if (reg.status() !== 200) throw new Error(`register failed: ${reg.status()}`);
  const setCookie = reg.headers()['set-cookie'] || '';
  const sessionCookie = setCookie.match(/session=[^;]+/);
  if (!sessionCookie) throw new Error('missing session cookie');
  const sessionValue = sessionCookie[0].substring('session='.length);
  await ctx.addCookies([{ name: 'session', value: sessionValue, domain: 'x.door.id', path: '/' }]);

  // Mock WebAuthn create()
  await page.addInitScript(() => {
    const createPayload = {
      id: 'cred-123',
      rawId: new Uint8Array([1, 2, 3]).buffer,
      type: 'public-key',
      response: {
        clientDataJSON: new Uint8Array([4, 5, 6]).buffer,
        attestationObject: new Uint8Array([7, 8, 9]).buffer,
      },
    };
    // @ts-ignore
    window.PublicKeyCredential = function() {};
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: {
        create: async () => createPayload,
        get: async () => null,
      },
    });
  });

  // Go to settings page after installing the browser mock.
  await page.goto(`${BASE}/settings`);
  await page.waitForLoadState('networkidle');

  let captured = null;

  // Intercept options & verify endpoints
  await page.route('**/api/auth/passkey/register/options', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        options: {
          challenge: b64urlFromBytes([10,11,12]),
          rp: { id: 'x.door.id', name: 'Door.id' },
          user: {
            id: b64urlFromBytes([1,2,3,4]),
            name: email,
            displayName: username,
          },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
          timeout: 60000,
          attestation: 'none',
          excludeCredentials: [],
          authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
        },
      }),
    });
  });
  await page.route('**/api/auth/passkey/register/verify', async route => {
    captured = JSON.parse(route.request().postData() || '{}');
    const ok = captured && captured.id && captured.rawId && captured.type && captured.response && captured.response.clientDataJSON && captured.response.attestationObject;
    await route.fulfill({
      status: ok ? 200 : 400,
      contentType: 'application/json',
      body: JSON.stringify(ok ? { success: true } : { error: 'missing fields' }),
    });
  });

  const optionsResponse = page.waitForResponse(r => r.url().includes('/api/auth/passkey/register/options')).catch(() => null);
  await page.getByRole('button', { name: /Daftarkan Biometrik/i }).click();
  const optionsRes = await optionsResponse;
  if (optionsRes && optionsRes.status() !== 200) {
    throw new Error(`register options failed: HTTP ${optionsRes.status()} ${await optionsRes.text()}`);
  }
  await page.waitForTimeout(1000);

  if (!captured) {
    const text = await page.locator('body').innerText();
    throw new Error(`verify payload not captured; page says: ${text.slice(-500)}`);
  }
  const required = ['id', 'rawId', 'type', 'response'];
  for (const k of required) if (!(k in captured)) throw new Error(`missing ${k}`);
  for (const k of ['clientDataJSON', 'attestationObject']) if (!(k in captured.response)) throw new Error(`missing response.${k}`);

  const success = await page.locator('text=Biometrik berhasil didaftarkan').isVisible().catch(() => false);
  if (!success) throw new Error('success message not visible');

  console.log('PASSKEY FLOW OK');
  await browser.close();
}

main().catch(err => { console.error(err.stack || err.message); process.exit(1); });
