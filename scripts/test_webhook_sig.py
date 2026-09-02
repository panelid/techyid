import json, hmac, hashlib, base64, time, subprocess, sys

HOME = '/data/data/com.termux/files/home'
secret = open(HOME + '/.resend_whsec').read().strip()
key_bytes = base64.b64decode(secret.replace('whsec_', ''))
WEBHOOK_URL = 'https://door-of-cloudflare.dalil.workers.dev/api/email/webhook/resend'

def sign(body_str, svix_id, ts):
    signed = f'{svix_id}.{ts}.{body_str}'
    return base64.b64encode(hmac.new(key_bytes, signed.encode(), hashlib.sha256).digest()).decode()

def post(label, body_obj, mode='good'):
    body_str = json.dumps(body_obj)
    svix_id = 'msg_test_%d' % int(time.time() * 1000)
    ts = str(int(time.time()) - (600 if mode == 'old' else 0))
    sig = sign(body_str, svix_id, ts)
    if mode == 'bad':
        sig = base64.b64encode(b'x' * 44).decode()
    cmd = ['curl', '-s', '-m', '30', '-w', '\\nHTTP:%{http_code}', '-X', 'POST',
           '-H', 'Content-Type: application/json',
           '-A', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36']
    if mode != 'nohdr':
        cmd += ['-H', 'svix-id: ' + svix_id, '-H', 'svix-timestamp: ' + ts,
                '-H', 'svix-signature: v1,' + sig]
    cmd += ['--data-binary', body_str, WEBHOOK_URL]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    print(label, '->', r.stdout.strip().replace('\n', ' | '))

payload = {'type': 'email.opened', 'data': {'id': 'probe-signature-only-no-match'}}
post('A1 signature BENAR      ', payload, 'good')
post('A2 signature SALAH      ', payload, 'bad')
post('A3 tanpa header svix    ', payload, 'nohdr')
post('A4 timestamp umur 10 mnt', payload, 'old')
