import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { createPasskeyAuthenticationOptions, getRPID } from "@/lib/auth/passkey";
import { signChallenge, CHALLENGE_COOKIE } from "@/lib/auth/passkey-challenge";

// POST /api/auth/passkey/login/options
// Generate authentication options. If an email is provided, restrict
// to passkeys registered to that user; otherwise allow any passkey for this RP.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email } = body;

    const db = getDB();
    if (!db) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
    }

    let credentialIds: string[] = [];
    let userId: string | null = null;

    if (email) {
      const user = await db.prepare(
        "SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1"
      ).bind(email).first();
      if (user) {
        userId = (user as any).id;
        const creds = await db.prepare(
          "SELECT credential_id FROM passkeys WHERE user_id = ?"
        ).bind(userId).all();
        credentialIds = (creds.results || []).map((r: any) => r.credential_id);
        if (credentialIds.length === 0) {
          return NextResponse.json({ error: "Tidak ada passkey terdaftar untuk email ini" }, { status: 404 });
        }
      } else {
        return NextResponse.json({ error: "Email tidak terdaftar" }, { status: 404 });
      }
    }

    const options = await createPasskeyAuthenticationOptions(request.url, credentialIds);
    const cookie = await signChallenge(options.challenge, userId, "login");

    const res = NextResponse.json({
      options: {
        ...options,
        challenge: options.challenge,
      },
      rpID: getRPID(request.url),
    });
    res.headers.append(
      "Set-Cookie",
      `${CHALLENGE_COOKIE}=${cookie}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=300`
    );
    return res;
  } catch (error: any) {
    console.error("[API:passkey:login:options]", error);
    return NextResponse.json({ error: "Terjadi kesalahan, coba lagi" }, { status: 500 });
  }
}
