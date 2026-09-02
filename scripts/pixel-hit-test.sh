#!/bin/bash
set -e
source ~/.hermes/.env
export ACCOUNT=$(grep CLOUDFLARE_ACCOUNT_ID ~/.hermes/.env | cut -d= -f2 | tr -d '"' | tr -d "'")
export KEY=$(grep CLOUDFLARE_GLOBAL_API_KEY ~/.hermes/.env | cut -d= -f2 | tr -d '"' | tr -d "'")
export EMAIL=$(grep CLOUDFLARE_EMAIL ~/.hermes/.env | cut -d= -f2 | tr -d '"' | tr -d "'")
export DBID="b237dace-8ea4-4038-a386-c201f6bd84f2"
cd ~/door-cf
TOKEN=*** -c "
import sys; sys.path.insert(0,'scripts')
from d1q import q
rows=q(\"SELECT et.token FROM sent_emails se JOIN email_tracking et ON et.sent_email_id=se.id WHERE se.subject='FORENSIK-2 mailinator'\")
print(rows[0]['token'])
")
echo "token=$TOKEN"
curl -s -o /dev/null -w "manual hit: %{http_code}\n" -m 20 "https://x.door.id/api/email/open/$TOKEN" -H "User-Agent: GmailImageProxy/1.0" -H "X-Forwarded-For: 209.85.221.100"
sleep 3
python3 -c "
import sys; sys.path.insert(0,'scripts')
from d1q import q
for r in q(\"SELECT se.status, et.hit_count, et.first_hit_headers FROM sent_emails se JOIN email_tracking et ON et.sent_email_id=se.id WHERE se.subject='FORENSIK-2 mailinator'\"):
    import json; print(json.dumps(r, indent=1))
"
