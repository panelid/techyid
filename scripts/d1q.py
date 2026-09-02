import json, os, subprocess, urllib.request, sys

def q(sql):
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{os.environ['ACCOUNT']}/d1/database/{os.environ['DBID']}/query",
        data=json.dumps({"sql": sql}).encode(),
        headers={"X-Auth-Email": os.environ["EMAIL"], "X-Auth-Key": os.environ["KEY"], "Content-Type": "application/json"},
    )
    d = json.load(urllib.request.urlopen(req, timeout=30))
    return d["result"][0]["results"]

if __name__ == "__main__":
    sql = sys.argv[1]
    for r in q(sql):
        print(json.dumps(r, indent=1))
