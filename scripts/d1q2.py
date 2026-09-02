import json, urllib.request, sys

env = {}
for line in open('/data/data/com.termux/files/home/.hermes/.env'):
    line = line.strip()
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1)
        env[k] = v.strip('"\'')

sql = sys.argv[1]
req = urllib.request.Request(
    f"https://api.cloudflare.com/client/v4/accounts/{env['CLOUDFLARE_ACCOUNT_ID']}/d1/database/b237dace-8ea4-4038-a386-c201f6bd84f2/query",
    data=json.dumps({"sql": sql}).encode(),
    headers={
        "X-Auth-Email": env['CLOUDFLARE_EMAIL'],
        "X-Auth-Key": env['CLOUDFLARE_GLOBAL_API_KEY'],
        "Content-Type": "application/json",
    },
)
try:
    d = json.load(urllib.request.urlopen(req, timeout=30))
    print(json.dumps(d['result'][0]['results'], indent=1))
except urllib.error.HTTPError as e:
    print('HTTP', e.code, e.read()[:500].decode())
