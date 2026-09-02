// Simple in-memory TTL cache for admin read endpoints.
// Reduces D1 read load: repeated calls within TTL hit memory instead of DB.
// Worker instances recycle, but this still cuts the majority of redundant reads.
const cache = new Map<string, { value: any; expires: number }>();

export function getCached(key: string): any | null {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  cache.delete(key);
  return null;
}

export function setCached(key: string, value: any, ttlMs = 30_000): void {
  cache.set(key, { value, expires: Date.now() + ttlMs });
}

export function withCache<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = getCached(key);
  if (hit !== null) return Promise.resolve(hit as T);
  return loader().then((v) => {
    setCached(key, v, ttlMs);
    return v;
  });
}
