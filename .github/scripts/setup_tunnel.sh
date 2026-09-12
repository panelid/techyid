#!/usr/bin/env bash
set -uo pipefail
exec > >(tee /tmp/tci.log 2>/dev/null) 2>&1
SUMMARY="${GITHUB_STEP_SUMMARY:-/tmp/sum.md}"
: > "$SUMMARY"
say(){ echo "$1"; echo "$1" >> "$SUMMARY"; }

TUN_NAME=techy-wa
HOST=app.techy.id
API="https://api.cloudflare.com/client/v4"
A=(-H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json")

# whoami account
ACC=$(curl -s "${A[@]}" "$API/accounts" | python3 -c 'import sys,json;d=json.load(sys.stdin);print((d.get("result") or [{}])[0].get("id","NO_ACCOUNT"))')
say "account_via_token=$ACC"
[ "$ACC" = "NO_ACCOUNT" ] && say "WARN token cannot list accounts"

# 1) create or reuse tunnel (cloudflare-managed config)
LIST=$(curl -s "${A[@]}" "$API/accounts/$CF_ACCT/cfd_tunnel?name=$TUN_NAME")
TUN=$(echo "$LIST" | python3 -c 'import sys,json;r=json.load(sys.stdin).get("result") or [];print(r[0]["id"] if r else "")')
if [ -z "$TUN" ]; then
  SEC=$(openssl rand -base64 32 | tr -d '\n/+=' | cut -c1-48)
  C=$(curl -s "${A[@]}" -X POST "$API/accounts/$CF_ACCT/cfd_tunnel" \
      -d "{\"name\":\"$TUN_NAME\",\"tunnel_secret\":\"$(openssl rand -hex 32)\",\"config_src\":\"cloudflare\"}")
  TUN=$(echo "$C" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["result"]["id"] if d.get("success") else "")')
  [ -z "$TUN" ] && { say "TUNNEL_CREATE_ERR=$(echo "$C"|python3 -c 'import sys,json;print(str(json.load(sys.stdin).get("errors"))[:160])')"; exit 1; }
fi
say "TUNNEL_ID=$TUN"

# 2) remote config: hostname -> localhost:3000
CFG=$(python3 -c "import json;print(json.dumps({'config':{'ingress':[{'hostname':'$HOST','service':'http://localhost:3000'},{'service':'http_status:404'}]}}))")
R=$(curl -s "${A[@]}" -X PUT "$API/accounts/$CF_ACCT/cfd_tunnel/$TUN/configurations" -d "$CFG")
say "CONFIG=$(echo "$R"|python3 -c 'import sys,json;d=json.load(sys.stdin);print("OK" if d.get("success") else str(d.get("errors"))[:160])')"

# 3) DNS record -> tunnel (try zone API with token)
J=$(python3 -c "import json;print(json.dumps({'type':'CNAME','name':'app','content':'$TUN.cfargotunnel.com','proxied':True}))")
D=$(curl -s "${A[@]}" -X POST "$API/zones/$CF_ZONE/dns_records" -d "$J")
DR=$(echo "$D"|python3 -c 'import sys,json;d=json.load(sys.stdin);print("DNS_OK" if d.get("success") else str(d.get("errors"))[:140])')
say "DNS=$DR"
# if proxied CNAME rejected (code 81696 dup / or needs zone dns edit), note it
[ "$DR" != "DNS_OK" ] && echo "$D" | python3 -c 'import sys,json;d=json.load(sys.stdin);e=(d.get("errors") or [{}])[0];say("DNS_ERR_CODE="+str(e.get("code")))' 2>/dev/null || true

# 4) run token (JWT) for --token
TT=$(curl -s "${A[@]}" "$API/accounts/$CF_ACCT/cfd_tunnel/$TUN/token" | python3 -c 'import sys,json;d=json.load(sys.stdin);r=d.get("result","");print(r if isinstance(r,str) and r.count(".")==2 else "")')
[ -z "$TT" ] && { say "TOKEN_ERR=not_jwt (need Zero Trust Tunnel Edit)"; exit 1; }
say "TOKEN_OK len=${#TT}"

# 5) push JWT to VPS + systemd cloudflared run --token, then restart
install -m 600 /dev/null ~/.ssh/id
printf '%s\n' "$VPS_SSH_KEY" > ~/.ssh/id; chmod 600 ~/.ssh/id
ssh-keyscan -p "$VPS_PORT" "$VPS_HOST" > ~/.ssh/kh 2>/dev/null || true
# token via stdin heredoc (never argv)
ssh -i ~/.ssh/id -o UserKnownHostsFile=~/.ssh/kh -o StrictHostKeyChecking=no -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" bash -s <<EOF
set -e
umask 077
mkdir -p /root/.cloudflared
cat > /root/.cloudflared/tunnel.env <<ENVEOF
TUNNEL_TOKEN=[REDACTED]
ENVEOF
cat > /etc/systemd/system/cf-tunnel.service <<SVCEOF
[Unit]
Description=Techy WA Gateway Cloudflare Named Tunnel
After=network-online.target techywa.service
Wants=network-online.target
[Service]
Type=simple
EnvironmentFile=/root/.cloudflared/tunnel.env
ExecStartPre=/bin/sleep 3
ExecStart=/usr/local/bin/cloudflared tunnel --no-autoupdate --token \$TUNNEL_TOKEN run
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
SVCEOF
systemctl daemon-reload
systemctl restart cf-tunnel
sleep 8
echo VPS_SVC=\$(systemctl is-active cf-tunnel)
EOF
say "VPS_DONE"
echo "=== SUMMARY ==="; cat "$SUMMARY"
