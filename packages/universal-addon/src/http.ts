const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
async function req(url: string, headers: Record<string,string>, text: boolean, ms: number): Promise<unknown> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { "User-Agent": UA, Accept: "application/json", ...headers } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return text ? r.text() : r.json();
  } finally { clearTimeout(t); }
}
export const getJson = (url: string, h: Record<string,string> = {}, ms = 8000) => req(url, h, false, ms);
export const getText = (url: string, h: Record<string,string> = {}, ms = 8000) => req(url, h, true, ms) as Promise<string>;
