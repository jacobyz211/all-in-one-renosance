import { cacheGet, cacheSet } from "./cache";
import { getJson } from "./http";

async function piHdrs(k: string, s: string): Promise<Record<string,string>> {
  const now = Math.floor(Date.now()/1000);
  const hash = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(k+s+now));
  const hex = [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");
  return { "X-Auth-Key":k, "X-Auth-Date":String(now), Authorization:`Bearer ${hex}`, "User-Agent":"UniversalResonanceAddon/1.0" };
}

export async function podcastIndexSearch(q: string, k: string, s: string): Promise<{tracks:unknown[];albums:unknown[]}> {
  if (!k||!s) return {tracks:[],albums:[]};
  const ck = `pi:s:${q}`; const cached = cacheGet<{tracks:unknown[];albums:unknown[]}>(ck); if (cached) return cached;
  try {
    const h = await piHdrs(k,s);
    const [fd, ed] = await Promise.allSettled([
      getJson(`https://api.podcastindex.org/api/1.0/search/byterm?q=${encodeURIComponent(q)}&max=8`,h),
      getJson(`https://api.podcastindex.org/api/1.0/search/byterm?q=${encodeURIComponent(q)}&max=15&fulltext`,h),
    ]);
    const feeds = (fd.status==="fulfilled" ? (fd.value as Record<string,unknown>)?.feeds as Record<string,unknown>[] : [])??[];
    const eps   = (ed.status==="fulfilled" ? (ed.value as Record<string,unknown>)?.items as Record<string,unknown>[] : [])??[];
    const albums = feeds.map(f => ({ id:`pi_show_${f.id}`, provider:"com.resonance.universal",
      title:(f.title as string)??"Unknown", artists:[{id:null,name:(f.author as string)??"Unknown"}],
      thumbnailURL:(f.artwork??f.image) as string|null, year:null }));
    const tracks = eps.slice(0,15).map(e => {
      const dur=(e.duration as number)??0;
      return { id:`pi_ep_${e.id}`, provider:"com.resonance.universal",
        title:(e.title as string)??"Unknown", artists:[{id:null,name:(e.feedTitle as string)??"Unknown"}],
        album:{id:`pi_show_${e.feedId}`,name:(e.feedTitle as string)??""},
        durationSeconds:dur||null, duration:dur?`${Math.floor(dur/60)}:${String(dur%60).padStart(2,"0")}`:null,
        thumbnailURL:(e.image??e.feedImage) as string|null,
        _streamUrl:(e.enclosureUrl as string)??null };
    });
    const result = {tracks,albums}; cacheSet(ck,result,300); return result;
  } catch { return {tracks:[],albums:[]}; }
}

export async function taddySearch(q: string, k: string, uid: string): Promise<{tracks:unknown[];albums:unknown[]}> {
  if (!k||!uid) return {tracks:[],albums:[]};
  const ck = `taddy:s:${q}`; const cached = cacheGet<{tracks:unknown[];albums:unknown[]}>(ck); if (cached) return cached;
  const gql = `query{search(term:"${q.replace(/"/g," ")}",filterForTypes:[PODCASTSERIES,PODCASTEPISODE],limitPerPage:8){podcastSeries{uuid name imageUrl}podcastEpisodes{uuid name audioUrl duration imageUrl podcastSeries{uuid name}}}}`;
  try {
    const res  = await fetch("https://api.taddy.org",{method:"POST",headers:{"Content-Type":"application/json","X-API-KEY":k,"X-USER-ID":uid},body:JSON.stringify({query:gql})});
    const data = await res.json() as Record<string,unknown>;
    const sr   = ((data?.data as Record<string,unknown>)?.search as Record<string,unknown>)??{};
    const albums = ((sr.podcastSeries as Record<string,unknown>[])??[]).map(s=>({ id:`taddy_show_${s.uuid}`, provider:"com.resonance.universal", title:(s.name as string)??"Unknown", artists:[{id:null,name:"Podcast"}], thumbnailURL:(s.imageUrl as string)??null, year:null }));
    const tracks = ((sr.podcastEpisodes as Record<string,unknown>[])??[]).map(e=>{
      const dur=(e.duration as number)??0; const ser=e.podcastSeries as Record<string,unknown>|null;
      return { id:`taddy_ep_${e.uuid}`, provider:"com.resonance.universal",
        title:(e.name as string)??"Unknown", artists:[{id:null,name:(ser?.name as string)??"Unknown"}],
        album:ser?{id:`taddy_show_${ser.uuid}`,name:ser.name as string}:null,
        durationSeconds:dur||null, duration:dur?`${Math.floor(dur/60)}:${String(dur%60).padStart(2,"0")}`:null,
        thumbnailURL:(e.imageUrl as string)??null, _streamUrl:(e.audioUrl as string)??null };
    });
    const result={tracks,albums}; cacheSet(ck,result,300); return result;
  } catch { return {tracks:[],albums:[]}; }
}

export async function piStreamUrl(epId: string, k: string, s: string): Promise<string|null> {
  const ck = `pi:str:${epId}`; const cached = cacheGet<string>(ck); if (cached) return cached;
  try {
    const h = await piHdrs(k,s);
    const data = await getJson(`https://api.podcastindex.org/api/1.0/episodes/byid?id=${epId}`,h) as Record<string,unknown>;
    const url  = (data?.episode as Record<string,unknown>)?.enclosureUrl as string;
    if (url) { cacheSet(ck,url,86400); return url; }
  } catch { /**/ }
  return null;
}
