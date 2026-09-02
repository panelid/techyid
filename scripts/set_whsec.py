import json, urllib.request, base64, os

HOME = '/data/data/com.termux/files/home'
env = {}
for line in open(HOME + '/.hermes/.env'):
    line = line.strip()
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1)
        env[k] = v.strip('"').strip("'")

acct = env['CLOUDFLARE_ACCOUNT_ID']
email = env['CLOUDFLARE_EMAIL']
key = env['CLOUDFLARE_GLOBAL_API_KEY']
secret = open(HOME + '/.resend_whsec').read().strip()

body = json.dumps({
    'name': 'RESEND_WEBHOOK_SECRET',
    'type': 'secret_text',
    'text': base64.b64encode(secret.encode()).decode(),
}).encode()

req = urllib.request.Request(
    'https://api.cloudflare.com/client/v4/accounts/%s/workers/scripts/door-of-cloudflare/secrets' % acct,
    data=body, method='PUT',
    headers={'X-Auth-Email': email, 'X-Auth-Key': key, 'Content-Type': 'application/json'})
try:
    resp = json.load(urllib.request.urlopen(req, timeout=30))
    print('SET_OK:', resp.get('success'), '| errors:', resp.get('errors'))
except urllib.error.HTTPError as e:
    print('HTTP', e.code, e.read()[:300].decode(errors='replace'))
    raise SystemExit(1)

# verify: list secret names
req2 = urllib.request.Request(
    'https://api.cloudflare.com/client/v4/accounts/%s/workers/scripts/door-of-cloudflare/secrets' % acct,
    headers={'X-Auth-Email': email, 'X-Auth-Key': key})
d = json.load(urllib.request.urlopen(req2, timeout=30))
names = sorted(s['name'] for s in d.get('result', []))
print('SECRETS NOW:', names)
print('PRESENT:', 'RESEND_WEBHOOK_SECRET' in names)
