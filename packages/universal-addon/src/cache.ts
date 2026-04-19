interface E { v: unknown; x: number }
const s = new Map<string, E>();
export function cacheGet<T>(k: string): T | null {
  const e = s.get(k); if (!e) return null;
  if (Date.now() > e.x) { s.delete(k); return null; }
  return e.v as T;
}
export function cacheSet(k: string, v: unknown, ttl: number) {
  if (s.size > 800) { const n = Date.now(); for (const [k,e] of s) if (e.x < n) s.delete(k); }
  s.set(k, { v, x: Date.now() + ttl * 1000 });
}
