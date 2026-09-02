import { cookies } from "next/headers";
import { verifySessionToken } from "./index";

export async function getSessionFromCookies() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;
  if (!sessionToken) return null;
  return verifySessionToken(sessionToken);
}
