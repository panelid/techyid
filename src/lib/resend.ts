import { getCloudflareContext } from "@opennextjs/cloudflare";

// Returns the server-side Resend API key. Mirrors the exact access pattern used
// in /api/resend-bridge (which is proven working in prod).
export function getResendKey(): string | undefined {
  const { env } = getCloudflareContext() as any;
  return env?.RESEND_API_KEY;
}
