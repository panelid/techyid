import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { env } = getCloudflareContext();
    const resendKey = (env as any).RESEND_API_KEY;
    if (!resendKey) return NextResponse.json({ error: "RESEND_API_KEY missing" }, { status: 500 });
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${resendKey}` },
    });
    const data: any = await res.json().catch(() => ({}));
    return NextResponse.json({ domains: data.data || [], total: (data.data || []).length });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { domainId } = await request.json();
    if (!domainId) return NextResponse.json({ error: "domainId required" }, { status: 400 });
    const { env } = getCloudflareContext();
    const resendKey = (env as any).RESEND_API_KEY;
    if (!resendKey) return NextResponse.json({ error: "RESEND_API_KEY missing" }, { status: 500 });
    const res = await fetch(`https://api.resend.com/domains/${domainId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${resendKey}` },
    });
    if (!res.ok) {
      const body: any = await res.json().catch(() => ({}));
      return NextResponse.json({ error: body.message || `Delete failed (${res.status})` }, { status: res.status });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
