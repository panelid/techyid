// src/lib/auth/passkey.ts
// WebAuthn / Passkey support using @simplewebauthn/server (v13)

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

// RP (Relying Party) identity — derived from the request origin so it works
// on techy.id (sandbox) and techy.id (production) alike.
export function getRPID(requestUrl: string): string {
  try {
    const url = new URL(requestUrl);
    return url.hostname;
  } catch {
    return "techy.id";
  }
}

export function getRPName(): string {
  return "Techy.id";
}

// Base64url helpers (same encoding WebAuthn uses)
export function base64urlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export interface PasskeyUser {
  id: string;
  username: string;
  email: string;
}

/**
 * Registration options for a logged-in user adding a passkey.
 */
export async function createPasskeyRegistrationOptions(
  requestUrl: string,
  user: PasskeyUser,
  existingCredentialIds: string[]
) {
  const rpID = getRPID(requestUrl);
  return generateRegistrationOptions({
    rpName: getRPName(),
    rpID,
    userID: new TextEncoder().encode(user.id),
    userName: user.email,
    userDisplayName: user.username || user.email,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    excludeCredentials: existingCredentialIds.map((id) => ({
      id: base64urlDecode(id),
      type: "public-key",
    })),
  });
}

export interface VerifiedRegistration {
  credentialId: string; // base64url
  publicKey: string; // base64url
  counter: number;
}

/**
 * Verify a registration response from the browser.
 */
export async function verifyPasskeyRegistration(
  requestUrl: string,
  registrationInfo: any,
  expectedChallenge: string
): Promise<VerifiedRegistration> {
  const rpID = getRPID(requestUrl);
  const origin = new URL(requestUrl).origin;
  const verification = await verifyRegistrationResponse({
    response: registrationInfo,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Registrasi passkey gagal diverifikasi");
  }

  const info: any = verification.registrationInfo;
  const credential = info.credential || info.credentialInfo || {};
  const credentialId =
    credential.id ||
    info.credentialID ||
    info.credentialId ||
    info.credential_id;
  const publicKeyBytes =
    credential.publicKey ||
    info.credentialPublicKey ||
    info.credential_public_key ||
    info.publicKey;
  // v13 stores counter inside registrationInfo.credential, not top-level.
  const counter =
    typeof credential.counter === 'number' ? credential.counter :
    typeof info.counter === 'number' ? info.counter :
    typeof info.signCount === 'number' ? info.signCount :
    info.counter ?? info.signCount;

  if (!credentialId || !publicKeyBytes || counter === undefined || counter === null) {
    console.error('[PASSKEY] incomplete registrationInfo', {
      keys: Object.keys(info || {}),
      credentialKeys: Object.keys(credential || {}),
      credentialId: !!credentialId,
      publicKey: !!publicKeyBytes,
      counter,
      raw: info,
    });
    throw new Error('Verifikasi passkey menghasilkan data tidak lengkap');
  }

  return {
    credentialId,
    publicKey: base64urlEncode(publicKeyBytes),
    counter: Number(counter),
  };
}

/**
 * Authentication options for passkey login. If no credential IDs are
 * provided, the browser will surface any passkey registered for this RP.
 */
export async function createPasskeyAuthenticationOptions(
  requestUrl: string,
  credentialIds?: string[]
) {
  const rpID = getRPID(requestUrl);
  return generateAuthenticationOptions({
    rpID,
    allowCredentials: credentialIds?.map((id) => ({
      id: base64urlDecode(id),
      type: "public-key",
    })),
    userVerification: "preferred",
  });
}

/**
 * Verify an authentication (login) response.
 */
export async function verifyPasskeyAuthentication(
  requestUrl: string,
  authenticationInfo: any,
  expectedChallenge: string,
  publicKey: string,
  counter: number
): Promise<{ verified: boolean; newCounter: number }> {
  const rpID = getRPID(requestUrl);
  const origin = new URL(requestUrl).origin;
  const verification = await verifyAuthenticationResponse({
    response: authenticationInfo,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: authenticationInfo.id,
      publicKey: base64urlDecode(publicKey),
      counter,
    },
  });

  return {
    verified: verification.verified,
    newCounter: verification.authenticationInfo.newCounter,
  };
}
