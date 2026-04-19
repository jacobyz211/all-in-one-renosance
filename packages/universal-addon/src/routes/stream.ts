import type { UniversalConfig } from "../index";
import { hifiStreamUrl } from "../hifi";
import { scStreamUrl } from "../soundcloud";
import { iaGetFiles } from "../internetarchive";
import { piStreamUrl } from "../podcasts";
import { lvoxChapterStream } from "../librivox";
import { cacheGet } from "../cache";

export async function handleStream(cfg: UniversalConfig, id: string): Promise<{url:string;format?:string;bitrate?:number|null}> {
  if (id.startsWith("hifi_")) {
    const s   = id.slice(5); const sep = s.indexOf("_"); if (sep===-1) throw new Error("Invalid HiFi ID");
    const r   = await hifiStreamUrl(s.slice(0,sep), s.slice(sep+1));
    if (!r) throw new Error("HiFi stream not found");
    return { url:r.url, format:r.format };
  }
  if (id.startsWith("sc_")) {
    const url = await scStreamUrl(id.slice(3), cfg.scClientId||undefined);
    if (!url) throw new Error("SoundCloud stream not found");
    return { url, format:"audio/mpeg", bitrate:128 };
  }
  if (id.startsWith("ia_track_")) {
    const ident = id.slice(9); const files = await iaGetFiles(ident);
    const best  = files.find(f=>/\.flac$/i.test(f.name as string)) ?? files.find(f=>/\.mp3$/i.test(f.name as string)) ?? files[0];
    if (!best) throw new Error("IA file not found");
    return { url:`https://archive.org/download/${ident}/${encodeURIComponent(best.name as string)}`, format:`audio/${(best.name as string).split(".").pop()?.toLowerCase()??"mp3"}` };
  }
  if (id.startsWith("ia_file_")) {
    const inner = id.slice(8); const last = inner.lastIndexOf("_");
    const ident = inner.slice(0,last); const idx = parseInt(inner.slice(last+1),10);
    const files = await iaGetFiles(ident); const file = files[idx];
    if (!file) throw new Error("IA file index out of range");
    return { url:`https://archive.org/download/${ident}/${encodeURIComponent(file.name as string)}`, format:`audio/${(file.name as string).split(".").pop()?.toLowerCase()??"mp3"}` };
  }
  if (id.startsWith("radio_")) {
    const uuid = id.slice(6);
    const r    = await fetch(`https://de1.api.radio-browser.info/json/stations/byuuid/${uuid}`).then(r=>r.json()) as Record<string,unknown>[];
    const url  = (r?.[0]?.url_resolved ?? r?.[0]?.url) as string;
    if (!url) throw new Error("Radio station URL not found");
    return { url, format:"audio/mpeg" };
  }
  if (id.startsWith("pi_ep_")) {
    const epId = id.slice(6);
    const cached = cacheGet<string>(`pi:str:${epId}`);
    if (cached) return { url:cached };
    if (cfg.piKey && cfg.piSecret) { const url = await piStreamUrl(epId, cfg.piKey, cfg.piSecret); if (url) return { url }; }
    throw new Error("Podcast episode URL not cached — re-search to refresh");
  }
  if (id.startsWith("taddy_ep_")) {
    const cached = cacheGet<string>(`taddy:ep:str:${id}`);
    if (cached) return { url:cached };
    throw new Error("Taddy episode URL not cached — re-search to refresh");
  }
  if (id.startsWith("lvox_ch_")) {
    const parts = id.split("_"); const bookId = parts[2]; const chIdx = parseInt(parts[3]??"0",10);
    if (!bookId) throw new Error("Invalid LibriVox chapter ID");
    const url = await lvoxChapterStream(bookId, chIdx);
    if (!url) throw new Error("LibriVox chapter not found");
    return { url, format:"audio/mpeg" };
  }
  throw new Error(`Unknown track ID prefix: ${id}`);
}
