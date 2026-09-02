// src/lib/email-body.ts
// Parse raw RFC822/MIME email jadi body teks bersih yang enak dibaca.
// Handle: multipart/*, quoted-printable, base64, text/html -> teks, reaksi Gmail.
//
// Alasan: worker techy-email-inbox nyimpen `raw` mentah (headers + boundary + QP)
// ke kolom D1 `body_text`. Route detail dulu cuma slice setelah `\r\n\r\n`, jadi
// yang tampil malah MIME mentah (--0000..., =F0=9F..., dst).

type Part = { headers: Record<string, string>; body: string };

function splitHeaders(text: string): { headers: Record<string, string>; body: string } {
  const m = text.match(/\r\n\r\n|\n\n/);
  if (!m) return { headers: {}, body: text };
  const sep = m[0];
  const idx = text.indexOf(sep);
  const headerRaw = text.slice(0, idx);
  const body = text.slice(idx + sep.length);
  const headers: Record<string, string> = {};
  let curKey = "";
  for (const line of headerRaw.split(/\r?\n/)) {
    if (/^\s+/.test(line)) {
      if (curKey) headers[curKey] += " " + line.trim();
      continue;
    }
    const ci = line.indexOf(":");
    if (ci === -1) continue;
    curKey = line.slice(0, ci).trim().toLowerCase();
    headers[curKey] = line.slice(ci + 1).trim();
  }
  return { headers, body };
}

function qpDecode(str: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === "=") {
      const pair = str.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(pair)) {
        out.push(parseInt(pair, 16));
        i += 2;
      } else if (str[i + 1] === "\r" && str[i + 2] === "\n") {
        i += 2; // soft line break
      } else if (str[i + 1] === "\n" || str[i + 1] === "\r") {
        i += 1; // soft line break
      } else {
        out.push(61); // literal '='
      }
    } else {
      out.push(c.charCodeAt(0));
    }
  }
  return new Uint8Array(out);
}

function base64Decode(str: string): Uint8Array {
  const bin = atob(str.replace(/\s+/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function decodeBytes(bytes: Uint8Array, charset: string): string {
  const cs = (charset || "utf-8").trim().toLowerCase();
  try {
    if (cs === "utf8") return new TextDecoder("utf-8").decode(bytes);
    if (cs === "utf-8" || cs === "utf-16") return new TextDecoder("utf-8").decode(bytes);
    return new TextDecoder(cs).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function decodeText(body: string, headers: Record<string, string>): string {
  const cte = (headers["content-transfer-encoding"] || "").toLowerCase();
  const ct = headers["content-type"] || "";
  const charset = ct.match(/charset=("?)([^";]+)\1?/i)?.[2] || "utf-8";
  let bytes: Uint8Array;
  if (cte === "quoted-printable") bytes = qpDecode(body);
  else if (cte === "base64") bytes = base64Decode(body);
  else bytes = new TextEncoder().encode(body);
  return decodeBytes(bytes, charset);
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote|ul|ol|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => {
      const code = parseInt(h, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&#(\d+);/g, (_m, n: string) => {
      const code = parseInt(n, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&amp;/gi, "&")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderReaction(json: string): string {
  try {
    const obj = JSON.parse(json);
    if (obj && obj.emoji) return "Reaksi: " + obj.emoji;
  } catch {
    /* fallthrough */
  }
  return "(Reaksi email) " + json.replace(/\s+/g, " ").slice(0, 200);
}

function getBoundary(ct: string): string {
  return ct.match(/boundary=("?)([^";]+)\1?/i)?.[2] || "";
}

function splitMultipart(body: string, boundary: string): Part[] {
  const delim = "--" + boundary;
  const parts: Part[] = [];
  for (let seg of body.split(delim)) {
    seg = seg.replace(/^\r?\n/, "");
    if (seg.startsWith("--")) continue; // closing delimiter
    if (!seg.trim()) continue;
    const { headers, body: b } = splitHeaders(seg);
    if (Object.keys(headers).length === 0) continue;
    parts.push({ headers, body: b });
  }
  return parts;
}

function processPart(
  body: string,
  headers: Record<string, string>
): { type: "plain" | "html" | "json"; text: string } {
  const ct = (headers["content-type"] || "text/plain").toLowerCase();

  if (ct.startsWith("multipart/")) {
    let plain = "";
    let html = "";
    let json = "";
    const boundary = getBoundary(ct);
    if (boundary) {
      for (const p of splitMultipart(body, boundary)) {
        const pct = (p.headers["content-type"] || "text/plain").toLowerCase();
        if (pct.startsWith("multipart/")) {
          const sub = processPart(p.body, p.headers);
          if (sub.type === "plain" && !plain) plain = sub.text;
          else if (sub.type === "html" && !html) html = sub.text;
          else if (sub.type === "json" && !json) json = sub.text;
        } else if (pct.startsWith("text/vnd.google.email-reaction") && !json) {
          json = decodeText(p.body, p.headers);
        } else if (pct.startsWith("text/plain") && !plain) {
          plain = decodeText(p.body, p.headers);
        } else if (pct.startsWith("text/html") && !html) {
          html = decodeText(p.body, p.headers);
        } else if (!plain && !html && !json) {
          plain = decodeText(p.body, p.headers);
        }
      }
    }
    if (plain) return { type: "plain", text: plain };
    if (html) return { type: "html", text: htmlToText(html) };
    if (json) return { type: "json", text: renderReaction(json) };
    return { type: "plain", text: body };
  }

  if (ct.startsWith("text/vnd.google.email-reaction")) {
    return { type: "json", text: renderReaction(decodeText(body, headers)) };
  }
  if (ct.startsWith("text/plain")) return { type: "plain", text: decodeText(body, headers) };
  if (ct.startsWith("text/html")) return { type: "html", text: htmlToText(decodeText(body, headers)) };
  return { type: "plain", text: decodeText(body, headers) };
}

export function extractEmailBody(raw: string): string {
  if (!raw) return "";
  const { headers, body } = splitHeaders(raw);
  const ct = headers["content-type"] || "";
  if (!ct.toLowerCase().includes("multipart")) {
    // Heuristic: kalau parent content-type hilang tapi body masih punya boundary MIME.
    const m = body.match(/^--([^\s]+)$/m);
    if (m) {
      const ghostBoundary = m[1];
      const patched = {
        ...headers,
        "content-type": `multipart/alternative; boundary="${ghostBoundary}"`,
      };
      return processPart(body, patched).text;
    }
  }
  return processPart(body, headers).text;
}
