#!/usr/bin/env bash
set -euo pipefail
TUN_NAME=techy-wa
HOST=app.techy.id
API="https://api.cloudflare.com/client/v4"
A=(-H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json")

# 1) find or create named tunnel (remote-configured) via REST
LIST=$(curl -s "${A[@]}" "$API/accounts/$CF_ACCT/cfd_tunnel?name=$TUN_NAME")
TUN=$(python3 -c "import sys,json;r=json.loads('''$LIST''').get('result') or [];print(r[0]['id'] if r else '')")
if [ -z "$TUN" ]; then
  C=$(curl -s "${A[@]}" -X POST "$API/accounts/$CF_ACCT/cfd_tunnel" -d "{\"name\":\"$TUN_NAME\",\"tunnel_secret\":\"$(openssl rand -base64 48)\",\"config_src\":\"cloudflare\"}")
  TUN=$(python3 -c "import sys,json;d=json.loads('''$C''');print(d['result']['id'] if d.get('success') else '')")
  [ -z "$TUN" ] && { echo "create fail: $(echo $C | head -c 200)"; exit 1; }
fi
echo "TUN=$TUN"

# 2) set remote config: hostname -> localhost:3000
CFG=$(python3 -c "import json;print(json.dumps({'config':{'ingress':[{'hostname':'$HOST','service':'http://localhost:3000'},{'service':'http_status:404'}]}}))")
R=$(curl -s "${A[@]}" -X PUT "$API/accounts/$CF_ACCT/cfd_tunnel/$TUN/configurations" -d "$CFG")
echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print('CFG_OK' if d.get('success') else ('CFG:'+str(d.get('errors'))[:160]))"

# 3) DNS record app.techy.id CNAME -> $TUN.cfargotunnel.com proxied
J=$(python3 -c "import json;print(json.dumps({'type':'CNAME','name':'app','content':'$TUN.cfargotunnel.com','proxied':True}))")
D=$(curl -s "${A[@]}" -X POST "$API/zones/$CF_ZONE/dns_records" -d "$J")
echo "$D" | python3 -c "import sys,json;d=json.load(sys.stdin);print('DNS_OK' if d.get('success') else ('DNS:'+str(d.get('errors'))[:120]))"

# 4) get tunnel run token (JWT) -> EnvironmentFile on VPS, no creds file, no login
TT=$(curl -s "${A[@]}" "$API/accounts/$CF_ACCT/cfd_tunnel/$TUN/token" | python3 -c "import sys,json;d=json.load(sys.stdin);r=d.get('result','');print(r if isinstance(r,str) and r.count('.')==2 else '')")
[ -z "$TT" ] && { echo "no JWT token; check permission 'Zero Trust: Tunnel: Edit'"; exit 1; }
echo "TOKEN len=${#TT}"

# 5) ssh to VPS, write token, write systemd unit, restart tunnel
install -m 600 /dev/null ~/.ssh/id
printf '%s\n' "$VPS_SSH_KEY" > ~/.ssh/id
chmod 600 ~/.ssh/id
ssh-keyscan -p "$VPS_PORT" "$VPS_HOST" > ~/.ssh/kh 2>/dev/null || true
# transfer token over stdin (never on command line)
ssh -i ~/.ssh/id -o UserKnownHostsFile=~/.ssh/kh -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" bash -s <<EOF
set -e
umask 077
printf 'TUNNEL_TOKEN=%s\n' '$TT' > /root/.cloudflared/tunnel.env
cat > /etc/systemd/system/cf-tunnel.service <<SVC
[Unit]
Description=Techy WA Gateway Cloudflare Named Tunnel
After=network-online.target techywa.service
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=/root/.cloudflared/tunnel.env
ExecStartPre=/bin/sleep 3
ExecStart=/usr/local/bin/cloudflared tunnel --no-autoupdate run
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVC
pkill -f 'cloudflared tunnel' 2>/dev/null || true
systemctl daemon-reload
systemctl enable --now cf-tunnel
sleep 8
systemctl is-active cf-tunnel && echo VPS_TUNNEL_UP
EOF
echo DONE
