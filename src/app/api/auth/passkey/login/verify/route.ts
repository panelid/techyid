import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { verifyPasskeyAuthentication } from "@/lib/auth/passkey";
import {
  verifyChallenge,
  CHALLENGE_COOKIE,
} from "@/lib/auth/passkey-challenge";

// POST /api/auth/passkey/login/verify
// Verify the WebAuthn assertion and create a session.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const cookieHeader = request.headers.get("cookie") || "";
    const pkCookie = cookieHeader
      .split(";")
      .find((c) => c.trim().startsWith(`${CHALLENGE_COOKIE}=`));
    if (!pkCookie) {
      return NextResponse.json({ error: "Sesi challenge kadaluarsa, coba lagi" }, { status: 400 });
    }

    const cookieValue = pkCookie.substring(pkCookie.indexOf("=") + 1).trim();
    const { challenge, userId } = await verifyChallenge(cookieValue, "login");

    const db = getDB();
    if (!db) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
    }

    // Look up the credential used in the assertion
    const credentialId = body?.id;
    if (!credentialId) {
      return NextResponse.json({ error: "Credential ID tidak ditemukan" }, { status: 400 });
    }

    const cred = await db.prepare(
      "SELECT id, user_id, credential_id, public_key, counter FROM passkeys WHERE credential_id = ? LIMIT 1"
    ).bind(credentialId).first();
    if (!cred) {
      return NextResponse.json({ error: "Passkey tidak terdaftar" }, { status: 404 });
    }

    // If the challenge was bound to a specific user, enforce it
    if (userId && (cred as any).user_id !== userId) {
      return NextResponse.json({ error: "Passkey tidak cocok dengan akun" }, { status: 403 });
    }

    const verification = await verifyPasskeyAuthentication(
      request.url,
      body,
      challenge,
      (cred as any).public_key,
      (cred as any).counter
    );

    if (!verification.verified) {
      return NextResponse.json({ error: "Verifikasi biometrik gagal" }, { status: 400 });
    }

    // Update counter to prevent replay
    await db.prepare("UPDATE passkeys SET counter = ? WHERE id = ?")
      .bind(verification.newCounter, (cred as any).id).run();

    // Fetch user info to build session
    const user = await db.prepare(
      "SELECT id, email, username FROM users WHERE id = ? LIMIT 1"
    ).bind((cred as any).user_id).first();
    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    const token = await createSessionToken({
      userId: (user as any).id,
      email: (user as any).email,
      username: (user as any).username,
    });

    const res = NextResponse.json({ success: true, user });
    res.headers.append("Set-Cookie", setSessionCookie(token));
    // Clear challenge cookie
    res.headers.append(
      "Set-Cookie",
      `${CHALLENGE_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
    );
    return res;
  } catch (error: any) {
    console.error("[API:passkey:login:verify]", error);
    return NextResponse.json({ error: error.message || "Gagal verifikasi passkey" }, { status: 400 });
  }
}
