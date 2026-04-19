import { cacheGet, cacheSet } from "./cache";
import { getJson, getText } from "./http";

export async function librivoxSearch(q: string): Promise<{tracks:unknown[];albums:unknown[]}> {
  const ck = `lvox:s:${q}`; const cached = cacheGet<{tracks:unknown[];albums:unknown[]}>(ck); if (cached) return cached;
  try {
    const data = await getJson(`https://librivox.org/api/feed/audiobooks?title=${encodeURIComponent(q)}&format=json&extended=1&limit=10`,{},8000) as Record<string,unknown>;
    const books = (data?.books as Record<string,unknown>[])??[];
    const albums = books.map(b=>{
      const au = (b.authors as Array<Record<string,unknown>>)?.[0];
      const an = au ? `${au.first_name??""} ${au.last_name??""}`.trim() : "LibriVox";
      return { id:`lvox_${b.id}`, provider:"com.resonance.universal", title:(b.title as string)??"Unknown", artists:[{id:null,name:an}], thumbnailURL:null, year:b.copyright_year?String(b.copyright_year):null };
    });
    const result={tracks:[],albums}; cacheSet(ck,result,300); return result;
  } catch { return {tracks:[],albums:[]}; }
}

export async function librivoxAlbumDetail(bookId: string): Promise<unknown|null> {
  const ck = `lvox:alb:${bookId}`; const cached = cacheGet<unknown>(ck); if (cached) return cached;
  try {
    const data = await getJson(`https://librivox.org/api/feed/audiobooks?id=${bookId}&format=json&extended=1`,{},8000) as Record<string,unknown>;
    const book = (data?.books as Record<string,unknown>[])?.[0]; if (!book) return null;
    const rssUrl = (book.url_rss??book.rss_url) as string; if (!rssUrl) return null;
    const xml    = await getText(rssUrl,{},8000);
    const items  = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    const au     = (book.authors as Array<Record<string,unknown>>)?.[0];
    const an     = au ? `${au.first_name??""} ${au.last_name??""}`.trim() : "LibriVox";
    const tracks = items.map((m,i)=>{
      const ch    = m[1]??"";
      const title = ch.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ?? ch.match(/<title>(.*?)<\/title>/)?.[1] ?? `Chapter ${i+1}`;
      const url   = ch.match(/<enclosure[^>]+url="([^"]+)"/)?.[1]??"";
      const ds    = ch.match(/<itunes:duration>(.*?)<\/itunes:duration>/)?.[1]??"";
      let dur=0;
      if (ds.includes(":")) { const p=ds.split(":").map(Number); dur=p.length===3?p[0]!*3600+p[1]!*60+p[2]!:p[0]!*60+p[1]!; }
      else if (ds) dur=parseInt(ds,10)||0;
      return { id:`lvox_ch_${bookId}_${i}`, provider:"com.resonance.universal",
        title, artists:[{id:null,name:an}], durationSeconds:dur||null,
        duration:dur?`${Math.floor(dur/60)}:${String(dur%60).padStart(2,"0")}`:null,
        thumbnailURL:null, _streamUrl:url||null };
    });
    const result={ id:`lvox_${bookId}`, provider:"com.resonance.universal",
      title:(book.title as string)??"Unknown", artists:[{id:null,name:an}], thumbnailURL:null, tracks };
    cacheSet(ck,result,3600); return result;
  } catch { return null; }
}

export async function lvoxChapterStream(bookId: string, chIdx: number): Promise<string|null> {
  const detail = await librivoxAlbumDetail(bookId); if (!detail) return null;
  const tracks = (detail as Record<string,unknown>).tracks as Array<Record<string,unknown>>;
  return (tracks?.[chIdx]?._streamUrl as string)??null;
}
