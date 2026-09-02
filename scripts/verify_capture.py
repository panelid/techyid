import json, hmac, hashlib, base64, subprocess, sys

HOME = '/data/data/com.termux/files/home'

def q(sql):
    r = subprocess.run(['python3', HOME + '/door-cf/scripts/d1q2.py', sql],
                       capture_output=True, text=True, timeout=60, cwd=HOME + '/door-cf')
    return json.loads(r.stdout)

row = q("SELECT headers, body FROM webhook_capture ORDER BY id DESC LIMIT 1")[0]
hdrs = json.loads(row['headers'])
sid = hdrs['svix-id']; ts = hdrs['svix-timestamp']; sig = hdrs['svix-signature']
body = row['body']
print('svix-id:', sid, '| ts:', ts, '| sig hdr:', sig[:60] + '...')

# body was truncated at 4000 chars in capture; content-length says 364 so fine
secret = open(HOME + '/.resend_whsec').read().strip()
kb = base64.b64decode(secret.replace('whsec_', ''))
expected = base64.b64encode(hmac.new(kb, f'{sid}.{ts}.{body}'.encode(), hashlib.sha256).digest()).decode()
got = sig.split('v1,')[-1].split(' ')[0]
print('expected:', expected)
print('got     :', got)
print('MATCH   :', expected == got)
