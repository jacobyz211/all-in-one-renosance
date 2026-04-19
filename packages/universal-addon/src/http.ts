const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
export async function getJson(url: string, h: Record<string,string> = {}, ms = 8000): Promise<unknown> {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { "User-Agent": UA, Accept: "application/json", ...h } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  } finally { clearTimeout(t); }
}
export async function getText(url: string, h: Record<string,string> = {}, ms = 8000): Promise<string> {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { "User-Agent": UA, ...h } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.text();
  } finally { clearTimeout(t); }
}
