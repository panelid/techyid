import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import {
  createPasskeyRegistrationOptions,
  getRPID,
  base64urlEncode,
} from "@/lib/auth/passkey";
import { signChallenge, CHALLENGE_COOKIE } from "@/lib/auth/passkey-challenge";

// POST /api/auth/passkey/register/options
// Generate WebAuthn registration options for the logged-in user.
export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDB();
    if (!db) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
    }

    // Fetch existing credential IDs so we don't re-register the same device
    const existing = await db.prepare(
      "SELECT credential_id FROM passkeys WHERE user_id = ?"
    ).bind(user.userId).all();
    const existingIds = (existing.results || []).map((r: any) => r.credential_id);

    const options = await createPasskeyRegistrationOptions(
      request.url,
      { id: user.userId, username: user.username || "", email: user.email },
      existingIds
    );

    // Store challenge in a signed HttpOnly cookie (stateless, survives Workers isolates)
    const challenge = options.challenge;
    const cookie = await signChallenge(
      challenge,
      user.userId,
      "register"
    );

    const res = NextResponse.json({
      options: {
        ...options,
        challenge: challenge,
      },
      rpID: getRPID(request.url),
    });
    res.headers.append(
      "Set-Cookie",
      `${CHALLENGE_COOKIE}=${cookie}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=300`
    );
    return res;
  } catch (error: any) {
    console.error("[API:passkey:register:options]", error);
    return NextResponse.json({ error: "Terjadi kesalahan, coba lagi" }, { status: 500 });
  }
}
