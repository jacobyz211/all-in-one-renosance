import { cacheGet, cacheSet } from "./cache";
import { getJson, getText } from "./http";

const SC = "https://api-v2.soundcloud.com";

async function getCid(provided?: string): Promise<string|null> {
  if (provided) return provided;
  const ck = "sc:cid"; const cached = cacheGet<string>(ck); if (cached) return cached;
  try {
    const html = await getText("https://soundcloud.com");
    const scripts = [...html.matchAll(/src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g)].map(m=>m[1]);
    for (const s of scripts.slice(-4).reverse()) {
      try { const js = await getText(s!); const m = js.match(/client_id\s*[=:]\s*["']([A-Za-z0-9]{32})["']/); if (m?.[1]) { cacheSet(ck,m[1],3600); return m[1]; } } catch { /**/ }
    }
  } catch { /**/ }
  return null;
}

export async function scSearch(q: string, provided?: string): Promise<unknown[]> {
  const ck = `sc:s:${q}`; const cached = cacheGet<unknown[]>(ck); if (cached) return cached;
  const cid = await getCid(provided); if (!cid) return [];
  try {
    const data = await getJson(`${SC}/search?q=${encodeURIComponent(q)}&limit=20&client_id=${cid}`) as Record<string,unknown>;
    const items = ((data?.collection as Record<string,unknown>[])??[]).filter(t=>t.kind==="track"&&t.streamable);
    const tracks = items.map(t => {
      const ms = (t.duration as number)??0; const s = Math.floor(ms/1000);
      return { id:`sc_${t.id}`, provider:"com.resonance.universal",
        title:t.title??"Unknown", artists:[{id:null,name:(t.user as Record<string,unknown>)?.username??"Unknown"}],
        album:null, durationSeconds:s||null, duration:s?`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`:null,
        thumbnailURL:((t.artwork_url as string)??"").replace("-large","-t500x500")||null };
    });
    cacheSet(ck, tracks, 120); return tracks;
  } catch { return []; }
}

export async function scStreamUrl(scId: string, provided?: string): Promise<string|null> {
  const ck = `sc:str:${scId}`; const cached = cacheGet<string>(ck); if (cached) return cached;
  const cid = await getCid(provided); if (!cid) return null;
  try {
    const data = await getJson(`${SC}/tracks/${scId}?client_id=${cid}`) as Record<string,unknown>;
    const ts = ((data?.media as Record<string,unknown>)?.transcodings as Array<Record<string,unknown>>)??[];
    const pick = ts.find(t=>(t.format as Record<string,unknown>)?.protocol==="progressive") ?? ts.find(t=>(t.format as Record<string,unknown>)?.mime_type==="audio/mpeg") ?? ts[0];
    if (!pick?.url) return null;
    const sd = await getJson(`${pick.url as string}?client_id=${cid}`) as Record<string,unknown>;
    const url = sd?.url as string; if (url) { cacheSet(ck,url,3500); return url; }
  } catch { /**/ }
  return null;
}
