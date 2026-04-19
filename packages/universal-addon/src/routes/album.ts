import type { UniversalConfig } from "../index";
import { hifiAlbumDetail } from "../hifi";
import { iaGetFiles } from "../internetarchive";
import { librivoxAlbumDetail } from "../librivox";

export async function handleAlbum(_cfg: UniversalConfig, id: string): Promise<unknown> {
  if (id.startsWith("hifi_album_")) {
    const inner = id.slice(11); const sep = inner.indexOf("_"); if (sep===-1) throw new Error("Invalid HiFi album ID");
    const result = await hifiAlbumDetail(inner.slice(0,sep), inner.slice(sep+1));
    if (!result) throw new Error("HiFi album not found"); return result;
  }
  if (id.startsWith("ia_album_")) {
    const ident = id.slice(9); const files = await iaGetFiles(ident);
    const art   = `https://archive.org/services/img/${ident}`;
    const tracks = files.map((f,i)=>{
      const name=(f.name as string)??""; const fmt=name.split(".").pop()?.toLowerCase()??"mp3";
      const dur=f.length?parseInt(f.length as string,10):null;
      return { id:`ia_file_${ident}_${i}`, provider:"com.resonance.universal",
        title:name.replace(/\.\w+$/,"").replace(/_/g," "), artists:[{id:null,name:"Internet Archive"}],
        durationSeconds:dur||null, duration:dur?`${Math.floor(dur/60)}:${String(dur%60).padStart(2,"0")}`:null,
        thumbnailURL:art, format:`audio/${fmt}` };
    });
    return { id, provider:"com.resonance.universal", title:ident, artists:[{id:null,name:"Internet Archive"}], thumbnailURL:art, tracks };
  }
  if (id.startsWith("lvox_")) {
    const result = await librivoxAlbumDetail(id.slice(5));
    if (!result) throw new Error("LibriVox book not found"); return result;
  }
  throw new Error(`Unknown album ID prefix: ${id}`);
}
