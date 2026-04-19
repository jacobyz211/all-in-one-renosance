import type { UniversalConfig } from "../index";
import { getJson } from "../http";
import { cacheGet, cacheSet } from "../cache";

export async function handlePlaylist(cfg: UniversalConfig, id: string): Promise<unknown> {
  if (id.startsWith("pi_show_")) {
    const feedId = id.slice(8); const ck = `pi:show:${feedId}`;
    const cached = cacheGet<unknown>(ck); if (cached) return cached;
    if (!cfg.piKey||!cfg.piSecret) throw new Error("Podcast Index credentials not configured");
    const now  = Math.floor(Date.now()/1000);
    const hash = await crypto.subtle.digest("SHA-1",new TextEncoder().encode(cfg.piKey+cfg.piSecret+now));
    const hex  = [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");
    const data = await getJson(`https://api.podcastindex.org/api/1.0/episodes/byfeedid?id=${feedId}&max=50`,
      {"X-Auth-Key":cfg.piKey,"X-Auth-Date":String(now),Authorization:`Bearer ${hex}`,"User-Agent":"UniversalResonanceAddon/1.0"}
    ) as Record<string,unknown>;
    const eps = (data?.items as Record<string,unknown>[])??[];
    const tracks = eps.map(e=>{const dur=(e.duration as number)??0;return{id:`pi_ep_${e.id}`,provider:"com.resonance.universal",title:(e.title as string)??"Unknown",artists:[{id:null,name:(e.feedTitle as string)??"Unknown"}],durationSeconds:dur||null,duration:dur?`${Math.floor(dur/60)}:${String(dur%60).padStart(2,"0")}`:null,thumbnailURL:(e.image??e.feedImage) as string|null};});
    const result={id,provider:"com.resonance.universal",title:"Podcast Episodes",tracks};
    cacheSet(ck,result,300); return result;
  }
  throw new Error(`Unknown playlist ID prefix: ${id}`);
}
