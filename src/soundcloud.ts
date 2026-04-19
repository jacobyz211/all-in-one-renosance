import { cacheGet, cacheSet } from "./cache";
import { getJson, getText } from "./http";
const SC="https://api-v2.soundcloud.com";
async function cid(p?: string): Promise<string|null> {
  if(p) return p; const ck="sc:cid"; const c=cacheGet<string>(ck); if(c) return c;
  try{ const html=await getText("https://soundcloud.com"); const ss=[...html.matchAll(/src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g)].map(m=>m[1]);
    for(const s of ss.slice(-4).reverse()){try{const js=await getText(s!);const m=js.match(/client_id\s*[=:]\s*["']([A-Za-z0-9]{32})["']/);if(m?.[1]){cacheSet(ck,m[1],3600);return m[1];}}catch{}}
  }catch{} return null;
}
export async function scSearch(q: string, p?: string): Promise<unknown[]> {
  const ck=`sc:s:${q}`; const c=cacheGet<unknown[]>(ck); if(c) return c;
  const id=await cid(p); if(!id) return [];
  try{ const d=await getJson(`${SC}/search?q=${encodeURIComponent(q)}&limit=20&client_id=${id}`) as Record<string,unknown>;
    const items=((d?.collection as Record<string,unknown>[])??[]).filter(t=>t.kind==="track"&&t.streamable);
    const tracks=items.map(t=>{const ms=(t.duration as number)??0;const s=Math.floor(ms/1000);return{id:`sc_${t.id}`,title:t.title??"Unknown",artist:(t.user as Record<string,unknown>)?.username??"Unknown",album:null,duration:s||null,artworkURL:((t.artwork_url as string)??"").replace("-large","-t500x500")||null,format:"mp3"};});
    cacheSet(ck,tracks,120); return tracks;
  }catch{return [];}
}
export async function scStream(scId: string, p?: string): Promise<string|null> {
  const ck=`sc:str:${scId}`; const c=cacheGet<string>(ck); if(c) return c;
  const id=await cid(p); if(!id) return null;
  try{ const d=await getJson(`${SC}/tracks/${scId}?client_id=${id}`) as Record<string,unknown>;
    const ts=((d?.media as Record<string,unknown>)?.transcodings as Array<Record<string,unknown>>)??[];
    const pick=ts.find(t=>(t.format as Record<string,unknown>)?.protocol==="progressive")??ts[0];
    if(!pick?.url) return null;
    const sd=await getJson(`${pick.url as string}?client_id=${id}`) as Record<string,unknown>;
    const url=sd?.url as string; if(url){cacheSet(ck,url,3500);return url;}
  }catch{} return null;
}
