import { cacheGet, cacheSet } from "./cache";
import { getJson } from "./http";

export async function iaSearch(q: string): Promise<{tracks:unknown[];albums:unknown[]}> {
  const ck = `ia:s:${q}`; const cached = cacheGet<{tracks:unknown[];albums:unknown[]}>(ck); if (cached) return cached;
  try {
    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}+AND+(mediatype:audio+OR+mediatype:etree)&fl[]=identifier,title,creator,year&sort[]=downloads+desc&rows=20&output=json`;
    const data = await getJson(url) as Record<string,unknown>;
    const docs = ((data?.response as Record<string,unknown>)?.docs as Record<string,unknown>[])??[];
    const albums: unknown[] = []; const tracks: unknown[] = [];
    for (const d of docs) {
      if (!d.identifier) continue;
      const id = d.identifier as string; const art = `https://archive.org/services/img/${id}`;
      const creator = Array.isArray(d.creator)?d.creator[0] as string:(d.creator as string??"Unknown");
      albums.push({ id:`ia_album_${id}`, provider:"com.resonance.universal", title:(d.title as string)??id, artists:[{id:null,name:creator}], thumbnailURL:art, year:d.year?String(d.year):null });
      tracks.push({ id:`ia_track_${id}`, provider:"com.resonance.universal", title:(d.title as string)??id, artists:[{id:null,name:creator}], album:{id:`ia_album_${id}`,name:(d.title as string)??id}, durationSeconds:null, duration:null, thumbnailURL:art });
    }
    const result = { tracks:tracks.slice(0,10), albums:albums.slice(0,8) };
    cacheSet(ck, result, 180); return result;
  } catch { return { tracks:[], albums:[] }; }
}

export async function iaGetFiles(identifier: string): Promise<Record<string,unknown>[]> {
  const ck = `ia:files:${identifier}`; const cached = cacheGet<Record<string,unknown>[]>(ck); if (cached) return cached;
  try {
    const data = await getJson(`https://archive.org/metadata/${identifier}`) as Record<string,unknown>;
    const files = ((data?.files as Record<string,unknown>[])??[]).filter(f=>/\.(mp3|flac|ogg|m4a|wav)$/i.test((f.name as string)??"")&&f.source!=="metadata").sort((a,b)=>((a.name as string)??"").localeCompare((b.name as string)??""));
    cacheSet(ck, files, 3600); return files;
  } catch { return []; }
}
