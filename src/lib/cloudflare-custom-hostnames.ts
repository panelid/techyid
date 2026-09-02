const CF_API = "https://api.cloudflare.com/client/v4";
import { getCloudflareContext } from "@opennextjs/cloudflare";

type CFEnv = { CF_ZONE_ID?: string; CF_API_TOKEN?: string; CF_API_EMAIL?: string };

function config(): CFEnv {
  try {
    const { env } = getCloudflareContext();
    return { CF_ZONE_ID: env.CF_ZONE_ID, CF_API_TOKEN: env.CF_API_TOKEN, CF_API_EMAIL: env.CF_API_EMAIL };
  } catch {}
  return {};
}

async function cfRequest(path: string, init: RequestInit = {}) {
  const { CF_ZONE_ID, CF_API_TOKEN, CF_API_EMAIL } = config();
  if (!CF_ZONE_ID || !CF_API_TOKEN || !CF_API_EMAIL) throw new Error("Cloudflare custom hostname configuration missing (CF_ZONE_ID, CF_API_TOKEN, CF_API_EMAIL)");
  const res = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: {
      "X-Auth-Email": CF_API_EMAIL,
      "X-Auth-Key": CF_API_TOKEN,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    throw new Error(body.errors?.map((e: any) => e.message).join(", ") || `Cloudflare API HTTP ${res.status}`);
  }
  return body.result;
}

export function createCustomHostname(hostname: string) {
  const { CF_ZONE_ID } = config();
  return cfRequest(`/zones/${CF_ZONE_ID}/custom_hostnames`, {
    method: "POST",
    body: JSON.stringify({ hostname, ssl: { method: "http", type: "dv", settings: { min_tls_version: "1.2" } } }),
  });
}

export function getCustomHostname(id: string) {
  const { CF_ZONE_ID } = config();
  return cfRequest(`/zones/${CF_ZONE_ID}/custom_hostnames/${encodeURIComponent(id)}`);
}

export function deleteCustomHostname(id: string) {
  const { CF_ZONE_ID } = config();
  return cfRequest(`/zones/${CF_ZONE_ID}/custom_hostnames/${encodeURIComponent(id)}`, { method: "DELETE" });
}
