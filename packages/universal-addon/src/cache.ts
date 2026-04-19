interface Entry { value: unknown; exp: number; }
const store = new Map<string, Entry>();
export function cacheGet<T>(key: string): T | null {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() > e.exp) { store.delete(key); return null; }
  return e.value as T;
}
export function cacheSet(key: string, value: unknown, ttlSec: number): void {
  if (store.size > 800) {
    const now = Date.now();
    for (const [k, v] of store) { if (v.exp < now) store.delete(k); }
  }
  store.set(key, { value, exp: Date.now() + ttlSec * 1000 });
}
