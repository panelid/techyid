import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { verifyPasskeyRegistration } from "@/lib/auth/passkey";
import {
  verifyChallenge,
  CHALLENGE_COOKIE,
} from "@/lib/auth/passkey-challenge";

// POST /api/auth/passkey/register/verify
// Verify the WebAuthn registration response and save the credential.
export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const cookieHeader = request.headers.get("cookie") || "";
    const pkCookie = cookieHeader
      .split(";")
      .find((c) => c.trim().startsWith(`${CHALLENGE_COOKIE}=`));
    if (!pkCookie) {
      return NextResponse.json({ error: "Challenge session expired" }, { status: 400 });
    }

    const cookieValue = pkCookie.substring(pkCookie.indexOf("=") + 1).trim();
    const { challenge, userId } = await verifyChallenge(cookieValue, "register");

    if (userId !== user.userId) {
      return NextResponse.json({ error: "Invalid user session" }, { status: 403 });
    }

    const db = getDB();
    if (!db) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
    }

    // Verify registration with SimpleWebAuthn
    const verification = await verifyPasskeyRegistration(
      request.url,
      body,
      challenge
    );

    // Save the new passkey credential to D1
    if (!verification.credentialId || !verification.publicKey || verification.counter === undefined || verification.counter === null) {
      console.error("[API:passkey:register:verify] incomplete verification data", {
        credentialId: verification.credentialId,
        publicKeyPresent: !!verification.publicKey,
        counter: verification.counter,
      });
      return NextResponse.json({ error: "Verifikasi passkey menghasilkan data tidak lengkap" }, { status: 400 });
    }
    await db.prepare(
      "INSERT INTO passkeys (id, user_id, credential_id, public_key, counter) VALUES (?, ?, ?, ?, ?)"
    ).bind(
      crypto.randomUUID(),
      user.userId,
      verification.credentialId,
      verification.publicKey,
      verification.counter
    ).run();

    const res = NextResponse.json({ success: true });
    // Clear challenge cookie
    res.headers.append(
      "Set-Cookie",
      `${CHALLENGE_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
    );
    return res;
  } catch (error: any) {
    console.error("[API:passkey:register:verify]", error);
    return NextResponse.json({ error: error.message || "Gagal verifikasi passkey" }, { status: 400 });
  }
}
