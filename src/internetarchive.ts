import { cacheGet, cacheSet } from "./cache";
import { getJson } from "./http";
export async function iaSearch(q: string) {
  const ck=`ia:s:${q}`; const c=cacheGet<unknown>(ck); if(c) return c;
  try{
    const d=await getJson(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}+AND+(mediatype:audio+OR+mediatype:etree)&fl[]=identifier,title,creator,year&sort[]=downloads+desc&rows=20&output=json`) as Record<string,unknown>;
    const docs=((d?.response as Record<string,unknown>)?.docs as Record<string,unknown>[])??[];
    const albums: unknown[]=[]; const tracks: unknown[]=[];
    for(const doc of docs){if(!doc.identifier)continue;const id=doc.identifier as string;const art=`https://archive.org/services/img/${id}`;const cr=Array.isArray(doc.creator)?doc.creator[0] as string:(doc.creator as string??"Unknown");
      albums.push({id:`ia_album_${id}`,title:(doc.title as string)??id,artist:cr,artworkURL:art,year:doc.year?String(doc.year):null});
      tracks.push({id:`ia_track_${id}`,title:(doc.title as string)??id,artist:cr,album:(doc.title as string)??id,duration:null,artworkURL:art,format:"mp3"});}
    const r={tracks:tracks.slice(0,10),albums:albums.slice(0,8)}; cacheSet(ck,r,180); return r;
  }catch{return{tracks:[],albums:[]};}
}
export async function iaFiles(identifier: string): Promise<Record<string,unknown>[]> {
  const ck=`ia:f:${identifier}`; const c=cacheGet<Record<string,unknown>[]>(ck); if(c) return c;
  try{
    const d=await getJson(`https://archive.org/metadata/${identifier}`) as Record<string,unknown>;
    const files=((d?.files as Record<string,unknown>[])??[]).filter(f=>/\.(mp3|flac|ogg|m4a|wav)$/i.test((f.name as string)??"")&&f.source!=="metadata").sort((a,b)=>((a.name as string)??"").localeCompare((b.name as string)??""));
    cacheSet(ck,files,3600); return files;
  }catch{return [];}
}
