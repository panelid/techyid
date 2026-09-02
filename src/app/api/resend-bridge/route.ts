import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionUser } from "@/lib/auth";

// Admin bridge to Resend API using the server-side key (never exposed).
// GET  ?path=/domains          → proxy GET
// POST { path, body }          → proxy POST
const ALLOWED_PREFIXES = ["/domains", "/webhooks", "/emails"];

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { env } = getCloudflareContext() as any;
  const key = env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ error: "RESEND_API_KEY missing" }, { status: 500 });

  const path = new URL(request.url).searchParams.get("path") || "/domains";
  if (!ALLOWED_PREFIXES.some((p) => path.startsWith(p))) return NextResponse.json({ error: "Path not allowed" }, { status: 400 });
  if (path.includes("..")) return NextResponse.json({ error: "Path not allowed" }, { status: 400 });

  const res = await fetch(`https://api.resend.com${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { env } = getCloudflareContext() as any;
  const key = env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ error: "RESEND_API_KEY missing" }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const path: string = body.path || "";
  const payload = body.body ?? {};
  const method: string = body.method || "POST";
  if (!ALLOWED_PREFIXES.some((p) => path.startsWith(p)) || path.includes("..")) {
    return NextResponse.json({ error: "Path not allowed" }, { status: 400 });
  }

  const res = await fetch(`https://api.resend.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}) as any);
  return NextResponse.json(data, { status: res.status });
}
