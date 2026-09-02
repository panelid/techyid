import subprocess, json, time

cookies = open('/data/data/com.termux/files/home/door_cookies.txt').read().strip()
payload = json.dumps({
    "to": "resistor0sbr0@gmail.com",
    "subject": "FILTER TEST B",
    "html": "<p>Test filter Google proxy. Kalau kamu baca ini manual, berarti dibuka manusia.</p>",
    "fromAddress": "testbaru@sobur.panel.id"
})
r = subprocess.run(['curl', '-s', '-X', 'POST', 'https://x.door.id/api/send',
                    '-H', 'Content-Type: application/json',
                    '-b', cookies, '--data', payload],
                   capture_output=True, text=True, timeout=60)
print("SEND:", r.stdout[:300])
