import { defineAddon } from "@resonance-addons/sdk";
import { cacheGet, cacheSet } from "./cache";
import { hifiSearch, hifiStream, hifiAlbum, hifiArtist, getInstances, b64e, b64d } from "./hifi";
import { scSearch, scStream } from "./soundcloud";
import { iaSearch, iaFiles } from "./internetarchive";
import { radioSearch } from "./radio";
import { lvoxSearch, lvoxAlbum, lvoxChStream } from "./librivox";
import { piSearch, taddySearch, piStream } from "./podcasts";

interface UniversalConfig {
  hifiInstances: string;
  scClientId?: string;
  piKey?: string;
  piSecret?: string;
  taddyKey?: string;
  taddyUid?: string;
}

async function handleSearch(cfg: UniversalConfig, q: string) {
  if (!q?.trim()) return { tracks: [], albums: [], artists: [] };
  const insts = getInstances(cfg.hifiInstances ?? "");
  const inst  = insts[Math.floor(Math.random() * insts.length)] ?? "";
  const isPod   = /podcast|episode|npr|radiolab|huberman|rogan|fridman|crime junkie/i.test(q);
  const isRadio = /\bfm\b|radio|station|lofi|lo-fi|chillhop|bbc/i.test(q);
  const isBook  = /audiobook|librivox|sherlock|austen|dickens|public domain/i.test(q);

  const [hifi, sc, ia, radio, lvox, pi, taddy] = await Promise.allSettled([
    inst ? hifiSearch(inst, q) : Promise.resolve({ tracks: [], albums: [], artists: [] }),
    scSearch(q, cfg.scClientId),
    iaSearch(q),
    radioSearch(q),
    lvoxSearch(q),
    piSearch(q, cfg.piKey ?? "", cfg.piSecret ?? ""),
    taddySearch(q, cfg.taddyKey ?? "", cfg.taddyUid ?? ""),
  ]);

  const hR = hifi.status  === "fulfilled" ? hifi.value  as { tracks: unknown[]; albums: unknown[]; artists: unknown[] } : { tracks: [], albums: [], artists: [] };
  const sR = sc.status    === "fulfilled" ? sc.value    : [];
  const iR = ia.status    === "fulfilled" ? ia.value    as { tracks: unknown[]; albums: unknown[] } : { tracks: [], albums: [] };
  const rR = radio.status === "fulfilled" ? radio.value : [];
  const lR = lvox.status  === "fulfilled" ? lvox.value  as { tracks: unknown[]; albums: unknown[] } : { tracks: [], albums: [] };
  const pR = pi.status    === "fulfilled" ? pi.value    as { tracks: unknown[]; albums: unknown[] } : { tracks: [], albums: [] };
  const tR = taddy.status === "fulfilled" ? taddy.value as { tracks: unknown[]; albums: unknown[] } : { tracks: [], albums: [] };

  if (isPod)    return { tracks: [...pR.tracks, ...tR.tracks, ...sR], albums: [...pR.albums, ...tR.albums], artists: [] };
  if (isRadio)  return { tracks: [...rR, ...sR, ...hR.tracks], albums: hR.albums, artists: hR.artists };
  if (isBook)   return { tracks: [...iR.tracks], albums: [...lR.albums, ...iR.albums], artists: [] };
  return { tracks: [...hR.tracks, ...sR, ...iR.tracks, ...rR], albums: [...hR.albums, ...lR.albums, ...iR.albums], artists: hR.artists };
}

async function handleStream(cfg: UniversalConfig, id: string) {
  if (id.startsWith("hifi_")) {
    const s=id.slice(5); const sep=s.indexOf("_"); if(sep===-1) throw new Error("Invalid HiFi ID");
    const r=await hifiStream(s.slice(0,sep),s.slice(sep+1));
    if(!r) throw new Error("HiFi stream not found");
    return{url:r.url,format:r.format,quality:r.quality};
  }
  if (id.startsWith("sc_")) {
    const url=await scStream(id.slice(3),cfg.scClientId);
    if(!url) throw new Error("SoundCloud stream not found");
    return{url,format:"mp3"};
  }
  if (id.startsWith("ia_track_")) {
    const ident=id.slice(9); const files=await iaFiles(ident);
    const best=files.find(f=>/\.flac$/i.test(f.name as string))??files.find(f=>/\.mp3$/i.test(f.name as string))??files[0];
    if(!best) throw new Error("IA file not found");
    return{url:`https://archive.org/download/${ident}/${encodeURIComponent(best.name as string)}`,format:(best.name as string).split(".").pop()??"mp3"};
  }
  if (id.startsWith("ia_file_")) {
    const inner=id.slice(8); const last=inner.lastIndexOf("_");
    const ident=inner.slice(0,last); const idx=parseInt(inner.slice(last+1),10);
    const files=await iaFiles(ident); const file=files[idx];
    if(!file) throw new Error("IA file not found");
    return{url:`https://archive.org/download/${ident}/${encodeURIComponent(file.name as string)}`,format:(file.name as string).split(".").pop()??"mp3"};
  }
  if (id.startsWith("radio_")) {
    const r=await fetch(`https://de1.api.radio-browser.info/json/stations/byuuid/${id.slice(6)}`).then(r=>r.json()) as Record<string,unknown>[];
    const url=(r?.[0]?.url_resolved??r?.[0]?.url) as string;
    if(!url) throw new Error("Radio URL not found");
    return{url,format:"mp3"};
  }
  if (id.startsWith("pi_ep_")) {
    const cached=cacheGet<string>(`pi:str:${id.slice(6)}`);
    if(cached) return{url:cached,format:"mp3"};
    if(cfg.piKey&&cfg.piSecret){const url=await piStream(id.slice(6),cfg.piKey,cfg.piSecret);if(url)return{url,format:"mp3"};}
    throw new Error("Podcast episode URL not cached — search again to refresh");
  }
  if (id.startsWith("taddy_ep_")) {
    const cached=cacheGet<string>(`taddy:str:${id}`);
    if(cached) return{url:cached,format:"mp3"};
    throw new Error("Taddy episode URL not cached — search again to refresh");
  }
  if (id.startsWith("lvox_ch_")) {
    const parts=id.split("_"); const bookId=parts[2]; const chIdx=parseInt(parts[3]??"0",10);
    if(!bookId) throw new Error("Invalid LibriVox chapter ID");
    const url=await lvoxChStream(bookId,chIdx);
    if(!url) throw new Error("LibriVox chapter not found");
    return{url,format:"mp3"};
  }
  throw new Error(`Unknown stream ID: ${id}`);
}

async function handleAlbum(cfg: UniversalConfig, id: string) {
  if(id.startsWith("hifi_album_")){const inner=id.slice(11);const sep=inner.indexOf("_");if(sep===-1)throw new Error("Invalid");return await hifiAlbum(inner.slice(0,sep),inner.slice(sep+1));}
  if(id.startsWith("ia_album_")){const ident=id.slice(9);const files=await iaFiles(ident);const art=`https://archive.org/services/img/${ident}`;const tracks=files.map((f,i)=>({id:`ia_file_${ident}_${i}`,title:(f.name as string).replace(/\.\w+$/,"").replace(/_/g," "),artist:"Internet Archive",duration:f.length?parseInt(f.length as string,10):null,artworkURL:art,format:(f.name as string).split(".").pop()??"mp3"}));return{id,title:ident,artist:"Internet Archive",artworkURL:art,tracks};}
  if(id.startsWith("lvox_")) return await lvoxAlbum(id.slice(5));
  throw new Error(`Unknown album ID: ${id}`);
}

async function handleArtist(cfg: UniversalConfig, id: string) {
  if(id.startsWith("hifi_artist_")){const inner=id.slice(12);const sep=inner.indexOf("_");if(sep===-1)throw new Error("Invalid");return await hifiArtist(inner.slice(0,sep),inner.slice(sep+1));}
  throw new Error(`Unknown artist ID: ${id}`);
}

async function handlePlaylist(cfg: UniversalConfig, id: string) {
  if(id.startsWith("pi_show_")){
    const feedId=id.slice(8);
    const now=Math.floor(Date.now()/1000);
    const hash=await crypto.subtle.digest("SHA-1",new TextEncoder().encode((cfg.piKey??"")+( cfg.piSecret??"")+now));
    const hex=[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");
    const d=await fetch(`https://api.podcastindex.org/api/1.0/episodes/byfeedid?id=${feedId}&max=50`,{headers:{"X-Auth-Key":cfg.piKey??"","X-Auth-Date":String(now),Authorization:`Bearer ${hex}`,"User-Agent":"UniversalAddon/1.0"}}).then(r=>r.json()) as Record<string,unknown>;
    const eps=(d?.items as Record<string,unknown>[])??[];
    const tracks=eps.map(e=>({id:`pi_ep_${e.id}`,title:(e.title as string)??"Unknown",artist:(e.feedTitle as string)??"Unknown",duration:(e.duration as number)??null,artworkURL:(e.image??e.feedImage) as string|null,format:"mp3",streamURL:(e.enclosureUrl as string)??null}));
    return{id,title:"Podcast Episodes",tracks};
  }
  throw new Error(`Unknown playlist ID: ${id}`);
}

// ── THIS IS THE EXACT STRUCTURE THAT WORKED ───────────────────────────────────
export const addon = defineAddon<UniversalConfig>({
  id: "com.resonance.universal",
  name: "Universal Media",
  description: "HiFi lossless · SoundCloud · Internet Archive · LibriVox audiobooks · Podcast Index · Taddy · Live Radio",
  version: "1.4.0",
  icon: { type: "remote", value: "https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/radio.svg" },
  resources: [
    {
      type: "catalog",
      catalogs: [
        {
          id: "search",
          name: "Search",
          isDefault: true,
          extra: [{ name: "search" }, { name: "skip" }, { name: "genre" }],
        },
      ],
    },
    {
      type: "stream",
      idPrefixes: ["com.resonance.universal","hifi_","sc_","ia_","radio_","pi_ep_","taddy_ep_","lvox_ch_"],
    },
  ],
  behaviorHints: { configurable: true, configurationRequired: true },
  auth: {
    type: "token",
    label: "Configure Universal Media. Only HiFi Instance URLs are required.",
    fields: [
      { key: "hifiInstances", type: "text",     title: "HiFi Instance URLs",       placeholder: "https://instance1.com,https://instance2.com", isRequired: true },
      { key: "scClientId",   type: "password",  title: "SoundCloud Client ID",     placeholder: "Optional", isRequired: false },
      { key: "piKey",        type: "password",  title: "Podcast Index API Key",    placeholder: "Optional", isRequired: false },
      { key: "piSecret",     type: "password",  title: "Podcast Index API Secret", placeholder: "Optional", isRequired: false },
      { key: "taddyKey",     type: "password",  title: "Taddy API Key",            placeholder: "Optional", isRequired: false },
      { key: "taddyUid",     type: "text",      title: "Taddy User ID",            placeholder: "Optional", isRequired: false },
    ],
  },
  handlers: {
    search:            (cfg, q) => handleSearch(cfg, q),
    resolveStream:     (cfg, id) => handleStream(cfg, id),
    getCatalog:        async (cfg, id, extra) => {
      const q = extra?.search ?? extra?.q ?? "";
      if (!q.trim()) {
        // No search query — return empty metas so home tab loads without error
        return { metas: [] };
      }
      const results = await handleSearch(cfg, q, undefined) as { tracks: any[]; albums: any[]; artists: any[] };
      const metas = [
        ...(results.tracks ?? []).map((t: any) => ({
          id:     t.id,
          type:   "track",
          name:   t.title,
          poster: t.artworkURL ?? null,
          description: t.artist ?? null,
        })),
        ...(results.albums ?? []).map((a: any) => ({
          id:     a.id,
          type:   "album",
          name:   a.title,
          poster: a.artworkURL ?? null,
          description: a.artist ?? null,
        })),
      ];
      return { metas };
    },
    getQuickAccess:    (cfg) => Promise.resolve(null),
    getAlbumDetail:    (cfg, id) => handleAlbum(cfg, id),
    getArtistDetail:   (cfg, id) => handleArtist(cfg, id),
    getPlaylistDetail: (cfg, id) => handlePlaylist(cfg, id),
  },
});
