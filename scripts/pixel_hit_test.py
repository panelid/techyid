import sys, json, subprocess
sys.path.insert(0, '/data/data/com.termux/files/home/door-cf/scripts')
import os
os.environ.setdefault('ACCOUNT', '')
from d1q import q

rows = q("SELECT et.token, se.status, et.hit_count FROM sent_emails se JOIN email_tracking et ON et.sent_email_id=se.id WHERE se.subject='FORENSIK-2 mailinator'")
token = rows[0]['token']
print('token=', token)
r = subprocess.run(['curl','-s','-o','/dev/null','-w','%{http_code}','-m','20',
    f'https://x.door.id/api/email/open/{token}',
    '-H','User-Agent: GmailImageProxy/1.0','-H','X-Forwarded-For: 209.85.221.100'], capture_output=True, text=True)
print('manual hit http:', r.stdout)
import time; time.sleep(3)
for x in q("SELECT se.status, et.hit_count, et.first_hit_headers FROM sent_emails se JOIN email_tracking et ON et.sent_email_id=se.id WHERE se.subject='FORENSIK-2 mailinator'"):
    print(json.dumps(x, indent=1))
