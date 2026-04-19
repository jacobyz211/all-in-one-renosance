import { cacheGet, cacheSet } from "./cache";
import { getJson } from "./http";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
export const getInstances = (r: string) => r.split(",").map(s=>s.trim().replace(/\/+$/,"")).filter(Boolean);
export const b64e = (s: string) => btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
export const b64d = (s: string) => atob(s.replace(/-/g,"+").replace(/_/g,"/"));
export const cover = (u?: string|null, sz=320) => u ? `https://resources.tidal.com/images/${u.replace(/-/g,"/")}/${sz}x${sz}.jpg` : null;
export const nd = (v?: number|null) => { if(!v) return 0; const n=Math.floor(v); return n>3600?Math.floor(n/1000):n; };
const LR = /\b(republic|island|atlantic|columbia|interscope|universal|sony|warner|capitol|rca|epic|polydor|parlophone|elektra|geffen|virgin|motown|records|music group|entertainment|llc|inc\.?)\b/i;
function an(t: Record<string,unknown>) {
  const all=(t.artists as Array<Record<string,unknown>>)??(t.artist?[t.artist as Record<string,unknown>]:[]);
  const main=all.filter(a=>a.type==="MAIN"||a.type==="FEATURED");
  const clean=all.filter(a=>a.name&&!LR.test(a.name as string));
  return ((main.length?main:clean.length?clean:all).map(a=>a.name as string).filter(Boolean).join(", "))||"Unknown";
}
export async function hifiSearch(inst: string, q: string) {
  const ck=`hifi:s:${inst}:${q}`; const hit=cacheGet<unknown>(ck); if(hit) return hit;
  const ib=b64e(inst); const p=`s=${encodeURIComponent(q)}&limit=30`;
  const [main,ar]=await Promise.allSettled([
    (async()=>{ for(const ep of [`${inst}/search/?${p}`,`${inst}/search?${p}`]) { try{return await getJson(ep,{"User-Agent":UA})}catch{} } return null; })(),
    getJson(`${inst}/artist/?s=${encodeURIComponent(q)}&limit=10`,{"User-Agent":UA},6000).catch(()=>null),
  ]);
  const items: Record<string,unknown>[]=[];
  if(main.status==="fulfilled"&&main.value){ const d=(main.value as Record<string,unknown>)?.data??main.value; items.push(...((d as Record<string,unknown>)?.items??(d as Record<string,unknown>)?.tracks??(Array.isArray(d)?d:[]) as Record<string,unknown>[])); }
  const tracks: unknown[]=[]; const albumMap: Record<string,unknown>={}; const artistMap: Record<string,{id:string;name:string;artworkURL:string|null;_h:number}>={}; 
  for(const t of items){
    if(!t?.id) continue;
    for(const a of ((t.artists as Array<Record<string,unknown>>)??(t.artist?[t.artist as Record<string,unknown>]:[]))) {
      if(!a?.id) continue; const k=String(a.id);
      if(!artistMap[k]) { const pic=a.picture?cover(a.picture as string):((a.images as Array<Record<string,unknown>>)?.[0])?.url as string??null; artistMap[k]={id:`hifi_artist_${ib}_${a.id}`,name:(a.name as string)??"Unknown",artworkURL:pic,_h:0}; }
      artistMap[k]!._h++;
    }
    if(t.streamReady===false) continue;
    const alb=t.album as Record<string,unknown>|null; const art=cover(alb?.cover as string); const name=an(t); const dur=nd(t.duration as number);
    tracks.push({id:`hifi_${ib}_${t.id}`,title:t.title??"Unknown",artist:name,album:alb?.title as string??null,duration:dur||null,artworkURL:art,format:"flac"});
    if(alb?.id){const aid=String(alb.id);if(!albumMap[aid])albumMap[aid]={id:`hifi_album_${ib}_${aid}`,title:alb.title??"Unknown Album",artist:name,artworkURL:art,year:alb.releaseDate?String(alb.releaseDate).slice(0,4):null};}
  }
  if(ar.status==="fulfilled"&&ar.value){
    const d=(ar.value as Record<string,unknown>)?.data??ar.value;
    for(const a of (((d as Record<string,unknown>)?.artists as Record<string,unknown>)?.items??(Array.isArray(d)?d:[])) as Record<string,unknown>[]) {
      if(!a?.id) continue; const k=String(a.id);
      if(!artistMap[k]) artistMap[k]={id:`hifi_artist_${ib}_${a.id}`,name:(a.name as string)??"Unknown",artworkURL:a.picture?cover(a.picture as string):null,_h:10};
      else artistMap[k]!._h+=10;
    }
  }
  const artists=Object.values(artistMap).sort((a,b)=>b._h-a._h).slice(0,5).map(({_h,...r})=>r);
  const result={tracks:tracks.slice(0,25),albums:Object.values(albumMap).slice(0,10),artists};
  cacheSet(ck,result,120); return result;
}
export async function hifiStream(instB64: string, origId: string) {
  const ck=`hifi:str:${instB64}:${origId}`; const hit=cacheGet<{url:string;format:string;quality:string}>(ck); if(hit) return hit;
  const inst=b64d(instB64);
  for(const ep of [`${inst}/stream/?id=${origId}`,`${inst}/stream?id=${origId}`,`${inst}/track/stream/?id=${origId}`]) {
    try{const d=await getJson(ep,{"User-Agent":UA},6000) as Record<string,unknown>; const url=(d?.url??d?.stream_url) as string|undefined; if(url?.startsWith("http")){const r={url,format:(d.codec??d.format??"flac") as string,quality:d.bitDepth?`${d.bitDepth}bit`:d.audioQuality as string??"lossless"};cacheSet(ck,r,3500);return r;}}catch{}
  }
  return null;
}
export async function hifiAlbum(instB64: string, albumId: string) {
  const ck=`hifi:alb:${instB64}:${albumId}`; const hit=cacheGet<unknown>(ck); if(hit) return hit;
  const inst=b64d(instB64);
  for(const ep of [`${inst}/album/?id=${albumId}`,`${inst}/album?id=${albumId}`]) {
    try{
      const raw=await getJson(ep,{"User-Agent":UA}) as Record<string,unknown>; const d=raw?.data??raw;
      const alb=(d as Record<string,unknown>)?.album??d; const items=((d as Record<string,unknown>)?.tracks??(d as Record<string,unknown>)?.items??(alb as Record<string,unknown>)?.tracks??[]) as Record<string,unknown>[];
      if(!items.length) continue;
      const art=cover((alb as Record<string,unknown>)?.cover as string,640);
      const tracks=items.filter(t=>t.streamReady!==false).map(t=>{const dur=nd(t.duration as number);return{id:`hifi_${instB64}_${t.id}`,title:t.title??"Unknown",artist:an(t),duration:dur||null,artworkURL:art,format:"flac"};});
      const result={id:`hifi_album_${instB64}_${albumId}`,title:(alb as Record<string,unknown>)?.title as string??"Unknown",artist:an(items[0]??{}),artworkURL:art,year:(alb as Record<string,unknown>)?.releaseDate?String((alb as Record<string,unknown>).releaseDate).slice(0,4):null,tracks};
      cacheSet(ck,result,3600); return result;
    }catch{}
  }
  return null;
}
export async function hifiArtist(instB64: string, artistId: string) {
  const ck=`hifi:art:${instB64}:${artistId}`; const hit=cacheGet<unknown>(ck); if(hit) return hit;
  const inst=b64d(instB64);
  const [infoR,topR,albR]=await Promise.allSettled([
    getJson(`${inst}/artist/?id=${artistId}`,{"User-Agent":UA}),
    getJson(`${inst}/artist/toptracks/?id=${artistId}&limit=20`,{"User-Agent":UA}),
    getJson(`${inst}/artist/albums/?id=${artistId}&limit=50`,{"User-Agent":UA}),
  ]);
  let info: Record<string,unknown>={};
  if(infoR.status==="fulfilled"){const d=(infoR.value as Record<string,unknown>)?.data??infoR.value;info=((d as Record<string,unknown>)?.artist??d) as Record<string,unknown>;}
  const name=(info.name as string)??"Unknown"; const art=cover(info.picture as string,480);
  const topTracks: unknown[]=[];
  if(topR.status==="fulfilled"){const td=(topR.value as Record<string,unknown>)?.data??topR.value;const items=((td as Record<string,unknown>)?.items??(td as Record<string,unknown>)?.tracks??(Array.isArray(td)?td:[])) as Record<string,unknown>[];for(const t of items.filter(t=>t.streamReady!==false).slice(0,20)){const dur=nd(t.duration as number);topTracks.push({id:`hifi_${instB64}_${t.id}`,title:t.title??"Unknown",artist:an(t)||name,duration:dur||null,artworkURL:cover((t.album as Record<string,unknown>)?.cover as string)??art,format:"flac"});}}
  const albums: unknown[]=[];
  if(albR.status==="fulfilled"){const ad=(albR.value as Record<string,unknown>)?.data??albR.value;for(const a of (((ad as Record<string,unknown>)?.items??(Array.isArray(ad)?ad:[])) as Record<string,unknown>[]).slice(0,50))albums.push({id:`hifi_album_${instB64}_${a.id}`,title:a.title??"Unknown",artist:name,artworkURL:cover(a.cover as string),year:a.releaseDate?String(a.releaseDate).slice(0,4):null});}
  const result={id:`hifi_artist_${instB64}_${artistId}`,name,artworkURL:art,topTracks,albums};
  cacheSet(ck,result,3600); return result;
}
