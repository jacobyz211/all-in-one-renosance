import { cacheGet, cacheSet } from "./cache";
import { getJson } from "./http";
async function ph(k:string,s:string) {
  const now=Math.floor(Date.now()/1000);
  const hash=await crypto.subtle.digest("SHA-1",new TextEncoder().encode(k+s+now));
  const hex=[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");
  return{"X-Auth-Key":k,"X-Auth-Date":String(now),Authorization:`Bearer ${hex}`,"User-Agent":"UniversalAddon/1.0"};
}
export async function piSearch(q:string,k:string,s:string) {
  if(!k||!s) return{tracks:[],albums:[]};
  const ck=`pi:s:${q}`; const c=cacheGet<unknown>(ck); if(c) return c;
  try{
    const h=await ph(k,s);
    const[fd,ed]=await Promise.allSettled([
      getJson(`https://api.podcastindex.org/api/1.0/search/byterm?q=${encodeURIComponent(q)}&max=8`,h),
      getJson(`https://api.podcastindex.org/api/1.0/search/byterm?q=${encodeURIComponent(q)}&max=15&fulltext`,h),
    ]);
    const feeds=(fd.status==="fulfilled"?(fd.value as Record<string,unknown>)?.feeds as Record<string,unknown>[]:null)??[];
    const eps=(ed.status==="fulfilled"?(ed.value as Record<string,unknown>)?.items as Record<string,unknown>[]:null)??[];
    const albums=feeds.map(f=>({id:`pi_show_${f.id}`,title:(f.title as string)??"Unknown",artist:(f.author as string)??"Unknown",artworkURL:(f.artwork??f.image) as string|null,year:null}));
    const tracks=eps.slice(0,15).map(e=>{const dur=(e.duration as number)??0;return{id:`pi_ep_${e.id}`,title:(e.title as string)??"Unknown",artist:(e.feedTitle as string)??"Unknown",album:(e.feedTitle as string)??null,duration:dur||null,artworkURL:(e.image??e.feedImage) as string|null,format:"mp3",streamURL:(e.enclosureUrl as string)??null};});
    const r={tracks,albums}; cacheSet(ck,r,300); return r;
  }catch{return{tracks:[],albums:[]};}
}
export async function taddySearch(q:string,k:string,uid:string) {
  if(!k||!uid) return{tracks:[],albums:[]};
  const ck=`taddy:s:${q}`; const c=cacheGet<unknown>(ck); if(c) return c;
  const gql=`query{search(term:"${q.replace(/"/g," ")}",filterForTypes:[PODCASTSERIES,PODCASTEPISODE],limitPerPage:8){podcastSeries{uuid name imageUrl}podcastEpisodes{uuid name audioUrl duration imageUrl podcastSeries{uuid name}}}}`;
  try{
    const res=await fetch("https://api.taddy.org",{method:"POST",headers:{"Content-Type":"application/json","X-API-KEY":k,"X-USER-ID":uid},body:JSON.stringify({query:gql})});
    const data=await res.json() as Record<string,unknown>;
    const sr=((data?.data as Record<string,unknown>)?.search as Record<string,unknown>)??{};
    const albums=((sr.podcastSeries as Record<string,unknown>[])??[]).map(s=>({id:`taddy_show_${s.uuid}`,title:(s.name as string)??"Unknown",artist:"Podcast",artworkURL:(s.imageUrl as string)??null,year:null}));
    const tracks=((sr.podcastEpisodes as Record<string,unknown>[])??[]).map(e=>{const dur=(e.duration as number)??0;const ser=e.podcastSeries as Record<string,unknown>|null;return{id:`taddy_ep_${e.uuid}`,title:(e.name as string)??"Unknown",artist:(ser?.name as string)??"Unknown",album:(ser?.name as string)??null,duration:dur||null,artworkURL:(e.imageUrl as string)??null,format:"mp3",streamURL:(e.audioUrl as string)??null};});
    const r={tracks,albums}; cacheSet(ck,r,300); return r;
  }catch{return{tracks:[],albums:[]};}
}
export async function piStream(epId:string,k:string,s:string): Promise<string|null> {
  const ck=`pi:str:${epId}`; const c=cacheGet<string>(ck); if(c) return c;
  try{const h=await ph(k,s);const d=await getJson(`https://api.podcastindex.org/api/1.0/episodes/byid?id=${epId}`,h) as Record<string,unknown>;const url=(d?.episode as Record<string,unknown>)?.enclosureUrl as string;if(url){cacheSet(ck,url,86400);return url;}}catch{}
  return null;
}
