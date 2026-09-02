import json, urllib.request, os, sys

HOME = '/data/data/com.termux/files/home'

def load_env(path):
    env = {}
    if not os.path.exists(path):
        return env
    for line in open(path):
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k] = v.strip('"').strip("'")
    return env

env = load_env(HOME + '/.hermes/.env')
key = env.get('RESEND_API_KEY') or os.environ.get('RESEND_API_KEY')
if not key:
    # try other common locations
    for cand in [HOME + '/.config/resend/key', HOME + '/.resend_key']:
        if os.path.exists(cand):
            key = open(cand).read().strip()
            break
if not key:
    print('RESEND_API_KEY not found in env files')
    sys.exit(2)

WID = 'a09eb2c2-6f91-45a4-b1fe-84b6dd448756'
req = urllib.request.Request('https://api.resend.com/webhooks/' + WID,
                             headers={'Authorization': 'Bearer ' + key})
try:
    d = json.load(urllib.request.urlopen(req, timeout=30))
except urllib.error.HTTPError as e:
    print('HTTP', e.code, e.read()[:200].decode(errors='replace'))
    sys.exit(1)

secret = d.get('signing_secret')
if not secret:
    print('no signing_secret in response; keys:', sorted(d.keys()))
    sys.exit(1)

fd = os.open(HOME + '/.resend_whsec', os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
os.write(fd, secret.encode())
os.close(fd)
print('WEBHOOK_NAME:', d.get('name'))
print('ENABLED:', d.get('enabled'))
print('URL:', d.get('url'))
print('EVENTS:', d.get('events'))
print('SECRET_SAVED: ~/.resend_whsec  LEN:', len(secret), 'PREFIX:', secret[:7] + '...')
