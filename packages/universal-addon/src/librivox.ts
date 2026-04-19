import { cacheGet, cacheSet } from "./cache";
import { getJson, getText } from "./http";
export async function lvoxSearch(q:string) {
  const ck=`lvox:s:${q}`; const c=cacheGet<unknown>(ck); if(c) return c;
  try{
    const d=await getJson(`https://librivox.org/api/feed/audiobooks?title=${encodeURIComponent(q)}&format=json&extended=1&limit=10`,{},8000) as Record<string,unknown>;
    const books=(d?.books as Record<string,unknown>[])??[];
    const albums=books.map(b=>{const au=(b.authors as Array<Record<string,unknown>>)?.[0];const name=au?`${au.first_name??""} ${au.last_name??""}`.trim():"LibriVox";return{id:`lvox_${b.id}`,title:(b.title as string)??"Unknown",artist:name,artworkURL:null,year:b.copyright_year?String(b.copyright_year):null};});
    const r={tracks:[],albums}; cacheSet(ck,r,300); return r;
  }catch{return{tracks:[],albums:[]};}
}
export async function lvoxAlbum(bookId:string): Promise<unknown|null> {
  const ck=`lvox:alb:${bookId}`; const c=cacheGet<unknown>(ck); if(c) return c;
  try{
    const d=await getJson(`https://librivox.org/api/feed/audiobooks?id=${bookId}&format=json&extended=1`,{},8000) as Record<string,unknown>;
    const book=(d?.books as Record<string,unknown>[])?.[0]; if(!book) return null;
    const rssUrl=(book.url_rss??book.rss_url) as string; if(!rssUrl) return null;
    const xml=await getText(rssUrl,{},8000);
    const items=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    const au=(book.authors as Array<Record<string,unknown>>)?.[0];
    const name=au?`${au.first_name??""} ${au.last_name??""}`.trim():"LibriVox";
    const tracks=items.map((m,i)=>{
      const ch=m[1]??"";
      const title=ch.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]??ch.match(/<title>(.*?)<\/title>/)?.[1]??`Chapter ${i+1}`;
      const url=ch.match(/<enclosure[^>]+url="([^"]+)"/)?.[1]??"";
      const ds=ch.match(/<itunes:duration>(.*?)<\/itunes:duration>/)?.[1]??"";
      let dur=0; if(ds.includes(":")){const p=ds.split(":").map(Number);dur=p.length===3?p[0]!*3600+p[1]!*60+p[2]!:p[0]!*60+p[1]!;}else if(ds)dur=parseInt(ds,10)||0;
      return{id:`lvox_ch_${bookId}_${i}`,title,artist:name,duration:dur||null,artworkURL:null,format:"mp3",streamURL:url||null};
    });
    const r={id:`lvox_${bookId}`,title:(book.title as string)??"Unknown",artist:name,artworkURL:null,tracks};
    cacheSet(ck,r,3600); return r;
  }catch{return null;}
}
export async function lvoxChStream(bookId:string,chIdx:number): Promise<string|null> {
  const d=await lvoxAlbum(bookId); if(!d) return null;
  return ((d as Record<string,unknown>).tracks as Array<Record<string,unknown>>)?.[chIdx]?.streamURL as string??null;
}
