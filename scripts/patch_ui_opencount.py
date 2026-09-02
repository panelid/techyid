import io

p = 'src/app/dashboard/email/page.tsx'
s = io.open(p, encoding='utf-8').read()

old1 = '                        {e.status === "clicked"\n                          ? <span style={{ background: "#7c3aed", color: "#fff", fontSize: 10, fontWeight: 900, padding: "2px 6px", borderRadius: 2, flexShrink: 0 }}>DIKLIK</span>'
new1 = '                        {e.hit_count > 1\n                          ? <span title="jumlah gambar email di-fetch (reload/manual)" style={{ background: "#f59e0b", color: "#fff", fontSize: 10, fontWeight: 900, padding: "2px 6px", borderRadius: 2, flexShrink: 0 }}>DIBUKA {e.hit_count}x</span>\n                          : null}\n' + old1
assert s.count(old1) == 1, 'list badge count=%d' % s.count(old1)
s = s.replace(old1, new1)

old2 = '                <div><div style={{ fontSize: 11, fontWeight: 800, color: "#888", textTransform: "uppercase" }}>Dikirim</div><div style={{ fontSize: 13 }}>{fmtSentDate(selectedSent.created_at)}</div></div>\n              </div>'
new2 = ('                <div><div style={{ fontSize: 11, fontWeight: 800, color: "#888", textTransform: "uppercase" }}>Dikirim</div><div style={{ fontSize: 13 }}>{fmtSentDate(selectedSent.created_at)}</div></div>\n'
        '                <div><div style={{ fontSize: 11, fontWeight: 800, color: "#888", textTransform: "uppercase" }}>Gambar di-fetch</div><div style={{ fontSize: 13 }}>{selectedSent.hit_count || 0}x{selectedSent.last_hit_at ? " \\u00b7 terakhir " + fmtSentDate(selectedSent.last_hit_at) : ""}</div></div>\n'
        '                <div><div style={{ fontSize: 11, fontWeight: 800, color: "#888", textTransform: "uppercase" }}>Klik</div><div style={{ fontSize: 13 }}>{selectedSent.click_count || 0}x</div></div>\n'
        '              </div>')
assert s.count(old2) == 1, 'detail count=%d' % s.count(old2)
s = s.replace(old2, new2)

io.open(p, 'w', encoding='utf-8').write(s)
print('UI PATCHED')
