import { cacheGet, cacheSet } from "./cache";
import { hifiSearch, hifiStream, hifiAlbum, hifiArtist, getInstances, b64e, b64d } from "./hifi";
import { scSearch, scStream } from "./soundcloud";
import { iaSearch, iaFiles } from "./internetarchive";
import { radioSearch } from "./radio";
import { lvoxSearch, lvoxAlbum, lvoxChStream } from "./librivox";
import { piSearch, taddySearch, piStream } from "./podcasts";

export interface Config {
  hifiInstances: string;
  scClientId?: string;
  piKey?: string;
  piSecret?: string;
  taddyKey?: string;
  taddyUid?: string;
}

// ── manifest ────────────────────────────────────────────────────────────────
export const manifest = {
  id: "com.eclipse.universal",
  name: "Universal Media",
  version: "1.4.0",
  description: "HiFi lossless · SoundCloud · Internet Archive · LibriVox · Podcasts · Live Radio",
  resources: ["search", "stream", "catalog"],
  types: ["track", "album", "artist", "playlist"],
  contentType: "music" as const,
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
};

// ── search ───────────────────────────────────────────────────────────────────
export async function search(cfg: Config, q: string) {
  if (!q?.trim()) return { tracks: [], albums: [], artists: [] };
  const insts = getInstances(cfg.hifiInstances ?? "");
  const inst  = insts[Math.floor(Math.random() * insts.length)] ?? "";
  const isPod  = /podcast|episode|serial|npr|radiolab|huberman|rogan|fridman|conan|crime junkie/i.test(q);
  const isRadio = /\bfm\b|radio|station|lofi|lo-fi|chillhop|ambient|bbc/i.test(q);
  const isBook  = /audiobook|librivox|sherlock|austen|dickens|tolkien|public domain/i.test(q);

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

  if (isPod)    return { tracks: [...pR.tracks, ...tR.tracks, ...sR, ...hR.tracks], albums: [...pR.albums, ...tR.albums], artists: [] };
  if (isRadio)  return { tracks: [...rR, ...sR, ...hR.tracks], albums: hR.albums, artists: hR.artists };
  if (isBook)   return { tracks: [...iR.tracks, ...hR.tracks], albums: [...lR.albums, ...iR.albums, ...hR.albums], artists: [] };
  return { tracks: [...hR.tracks, ...sR, ...iR.tracks, ...rR], albums: [...hR.albums, ...lR.albums, ...iR.albums], artists: hR.artists };
}

// ── stream ───────────────────────────────────────────────────────────────────
export async function stream(cfg: Config, id: string) {
  if (id.startsWith("hifi_")) {
    const s = id.slice(5); const sep = s.indexOf("_"); if (sep === -1) throw new Error("Invalid HiFi ID");
    const r = await hifiStream(s.slice(0, sep), s.slice(sep + 1));
    if (!r) throw new Error("HiFi stream not found");
    return { url: r.url, format: r.format, quality: r.quality };
  }
  if (id.startsWith("sc_")) {
    const url = await scStream(id.slice(3), cfg.scClientId);
    if (!url) throw new Error("SoundCloud stream not found");
    return { url, format: "mp3" };
  }
  if (id.startsWith("ia_track_")) {
    const ident = id.slice(9); const files = await iaFiles(ident);
    const best = files.find(f => /\.flac$/i.test(f.name as string)) ?? files.find(f => /\.mp3$/i.test(f.name as string)) ?? files[0];
    if (!best) throw new Error("IA file not found");
    return { url: `https://archive.org/download/${ident}/${encodeURIComponent(best.name as string)}`, format: (best.name as string).split(".").pop() ?? "mp3" };
  }
  if (id.startsWith("ia_file_")) {
    const inner = id.slice(8); const last = inner.lastIndexOf("_");
    const ident = inner.slice(0, last); const idx = parseInt(inner.slice(last + 1), 10);
    const files = await iaFiles(ident); const file = files[idx];
    if (!file) throw new Error("IA file not found");
    return { url: `https://archive.org/download/${ident}/${encodeURIComponent(file.name as string)}`, format: (file.name as string).split(".").pop() ?? "mp3" };
  }
  if (id.startsWith("radio_")) {
    const r = await fetch(`https://de1.api.radio-browser.info/json/stations/byuuid/${id.slice(6)}`).then(r => r.json()) as Record<string,unknown>[];
    const url = (r?.[0]?.url_resolved ?? r?.[0]?.url) as string;
    if (!url) throw new Error("Radio URL not found");
    return { url, format: "mp3" };
  }
  if (id.startsWith("pi_ep_")) {
    const cached = cacheGet<string>(`pi:str:${id.slice(6)}`);
    if (cached) return { url: cached };
    if (cfg.piKey && cfg.piSecret) { const url = await piStream(id.slice(6), cfg.piKey, cfg.piSecret); if (url) return { url, format: "mp3" }; }
    throw new Error("Podcast episode URL not cached — re-search to refresh");
  }
  if (id.startsWith("taddy_ep_")) {
    const cached = cacheGet<string>(`taddy:str:${id}`);
    if (cached) return { url: cached };
    throw new Error("Taddy episode URL not cached — re-search to refresh");
  }
  if (id.startsWith("lvox_ch_")) {
    const parts = id.split("_"); const bookId = parts[2]; const chIdx = parseInt(parts[3] ?? "0", 10);
    if (!bookId) throw new Error("Invalid LibriVox chapter ID");
    const url = await lvoxChStream(bookId, chIdx);
    if (!url) throw new Error("LibriVox chapter not found");
    return { url, format: "mp3" };
  }
  throw new Error(`Unknown stream ID: ${id}`);
}

// ── album ────────────────────────────────────────────────────────────────────
export async function album(cfg: Config, id: string) {
  if (id.startsWith("hifi_album_")) {
    const inner = id.slice(11); const sep = inner.indexOf("_"); if (sep === -1) throw new Error("Invalid HiFi album ID");
    return await hifiAlbum(inner.slice(0, sep), inner.slice(sep + 1));
  }
  if (id.startsWith("ia_album_")) {
    const ident = id.slice(9); const files = await iaFiles(ident);
    const art = `https://archive.org/services/img/${ident}`;
    const tracks = files.map((f, i) => ({ id: `ia_file_${ident}_${i}`, title: (f.name as string).replace(/\.\w+$/, "").replace(/_/g, " "), artist: "Internet Archive", duration: f.length ? parseInt(f.length as string, 10) : null, artworkURL: art, format: (f.name as string).split(".").pop() ?? "mp3" }));
    return { id, title: ident, artist: "Internet Archive", artworkURL: art, tracks };
  }
  if (id.startsWith("lvox_")) return await lvoxAlbum(id.slice(5));
  throw new Error(`Unknown album ID: ${id}`);
}

// ── artist ───────────────────────────────────────────────────────────────────
export async function artist(cfg: Config, id: string) {
  if (id.startsWith("hifi_artist_")) {
    const inner = id.slice(12); const sep = inner.indexOf("_"); if (sep === -1) throw new Error("Invalid HiFi artist ID");
    return await hifiArtist(inner.slice(0, sep), inner.slice(sep + 1));
  }
  throw new Error(`Unknown artist ID: ${id}`);
}

// ── playlist ─────────────────────────────────────────────────────────────────
export async function playlist(cfg: Config, id: string) {
  if (id.startsWith("pi_show_")) {
    const feedId = id.slice(8);
    const now = Math.floor(Date.now() / 1000);
    const hash = await crypto.subtle.digest("SHA-1", new TextEncoder().encode((cfg.piKey ?? "") + (cfg.piSecret ?? "") + now));
    const hex = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
    const d = await fetch(`https://api.podcastindex.org/api/1.0/episodes/byfeedid?id=${feedId}&max=50`, { headers: { "X-Auth-Key": cfg.piKey ?? "", "X-Auth-Date": String(now), Authorization: `Bearer ${hex}`, "User-Agent": "UniversalAddon/1.0" } }).then(r => r.json()) as Record<string,unknown>;
    const eps = (d?.items as Record<string,unknown>[]) ?? [];
    const tracks = eps.map(e => ({ id: `pi_ep_${e.id}`, title: (e.title as string) ?? "Unknown", artist: (e.feedTitle as string) ?? "Unknown", duration: (e.duration as number) ?? null, artworkURL: (e.image ?? e.feedImage) as string | null, format: "mp3", streamURL: (e.enclosureUrl as string) ?? null }));
    return { id, title: "Podcast Episodes", tracks };
  }
  throw new Error(`Unknown playlist ID: ${id}`);
}
