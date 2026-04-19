import { cacheGet, cacheSet } from "./cache";
import { getJson } from "./http";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
export const getInstances = (raw: string) => raw.split(",").map(s => s.trim().replace(/\/+$/, "")).filter(Boolean);
export const b64enc = (s: string) => btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
export const b64dec = (s: string) => atob(s.replace(/-/g,"+").replace(/_/g,"/"));
export const coverUrl = (uuid?: string|null, sz = 320) => uuid ? `https://resources.tidal.com/images/${uuid.replace(/-/g,"/")}/${sz}x${sz}.jpg` : null;
export const normDur = (v?: number|null) => { if (!v) return 0; const n = Math.floor(v); return n > 3600 ? Math.floor(n/1000) : n; };
export const fmtDur  = (s: number) => s ? `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}` : null;

const LABEL_RE = /\b(republic|island|atlantic|columbia|interscope|universal|sony|warner|capitol|def jam|rca|epic|polydor|parlophone|elektra|geffen|virgin|motown|label|records|music group|entertainment|distribution|publishing|llc|inc\.?)\b/i;
function artist(t: Record<string,unknown>): string {
  const all = (t.artists as Array<Record<string,unknown>>) ?? (t.artist ? [t.artist as Record<string,unknown>] : []);
  const main = all.filter(a => a.type === "MAIN" || a.type === "FEATURED");
  const clean = all.filter(a => a.name && !LABEL_RE.test(a.name as string));
  return ((main.length ? main : clean.length ? clean : all).map(a => a.name as string).filter(Boolean).join(", ")) || "Unknown";
}

export interface HifiResult { tracks: unknown[]; albums: unknown[]; artists: unknown[]; }

export async function hifiSearch(inst: string, q: string): Promise<HifiResult> {
  const ck = `hifi:s:${inst}:${q}`;
  const hit = cacheGet<HifiResult>(ck);
  if (hit) return hit;
  const ib = b64enc(inst);
  const p  = `s=${encodeURIComponent(q)}&limit=30`;
  const [main, ar] = await Promise.allSettled([
    (async () => {
      for (const ep of [`${inst}/search/?${p}`, `${inst}/search?${p}`]) {
        try { return await getJson(ep, { "User-Agent": UA }); } catch { /**/ }
      }
      return null;
    })(),
    getJson(`${inst}/artist/?s=${encodeURIComponent(q)}&limit=10`, { "User-Agent": UA }, 6000).catch(() => null),
  ]);
  const items: Record<string,unknown>[] = [];
  if (main.status === "fulfilled" && main.value) {
    const d = (main.value as Record<string,unknown>)?.data ?? main.value;
    const list = (d as Record<string,unknown>)?.items ?? (d as Record<string,unknown>)?.tracks ?? (d as Record<string,unknown>)?.results ?? (Array.isArray(d) ? d : []);
    items.push(...(list as Record<string,unknown>[]));
  }
  const tracks: unknown[] = [];
  const albumMap: Record<string,unknown> = {};
  const artistMap: Record<string,{ id:string; name:string; artworkURL:string|null; _h:number }> = {};
  for (const t of items) {
    if (!t?.id) continue;
    const all = (t.artists as Array<Record<string,unknown>>) ?? (t.artist ? [t.artist as Record<string,unknown>] : []);
    for (const a of all) {
      if (!a?.id) continue;
      const k = String(a.id);
      if (!artistMap[k]) {
        const pic = a.picture ? coverUrl(a.picture as string) : ((a.images as Array<Record<string,unknown>>)?.[0])?.url as string ?? null;
        artistMap[k] = { id: `hifi_artist_${ib}_${a.id}`, name: (a.name as string) ?? "Unknown", artworkURL: pic, _h: 0 };
      }
      artistMap[k]!._h++;
    }
    if (t.streamReady === false) continue;
    const alb = t.album as Record<string,unknown>|null;
    const art = coverUrl(alb?.cover as string);
    const an  = artist(t);
    const dur = normDur(t.duration as number);
    tracks.push({ id: `hifi_${ib}_${t.id}`, provider: "com.resonance.universal",
      title: t.title ?? "Unknown", artists: [{ id: null, name: an }],
      album: alb?.title ? { id: alb.id ? `hifi_album_${ib}_${alb.id}` : null, name: alb.title } : null,
      durationSeconds: dur || null, duration: fmtDur(dur), thumbnailURL: art });
    if (alb?.id) {
      const aid = String(alb.id);
      if (!albumMap[aid]) albumMap[aid] = { id: `hifi_album_${ib}_${aid}`, provider: "com.resonance.universal",
        title: alb.title ?? "Unknown Album", artists: [{ id: null, name: an }],
        thumbnailURL: art, year: alb.releaseDate ? String(alb.releaseDate).slice(0,4) : null };
    }
  }
  if (ar.status === "fulfilled" && ar.value) {
    const d = (ar.value as Record<string,unknown>)?.data ?? ar.value;
    const arl = ((d as Record<string,unknown>)?.artists as Record<string,unknown>)?.items as Record<string,unknown>[] ?? (Array.isArray(d) ? d : []) as Record<string,unknown>[];
    for (const a of arl as Record<string,unknown>[]) {
      if (!a?.id) continue;
      const k = String(a.id);
      if (!artistMap[k]) artistMap[k] = { id: `hifi_artist_${ib}_${a.id}`, name: (a.name as string)??"Unknown", artworkURL: a.picture ? coverUrl(a.picture as string) : null, _h: 10 };
      else { artistMap[k]!._h += 10; }
    }
  }
  const artists = Object.values(artistMap).sort((a,b) => b._h - a._h).slice(0,5).map(({ _h, ...r }) => r);
  const result: HifiResult = { tracks: tracks.slice(0,25), albums: Object.values(albumMap).slice(0,10), artists };
  cacheSet(ck, result, 120);
  return result;
}

export async function hifiStreamUrl(instB64: string, origId: string): Promise<{ url:string; format:string; quality:string }|null> {
  const ck = `hifi:str:${instB64}:${origId}`;
  const hit = cacheGet<{ url:string; format:string; quality:string }>(ck);
  if (hit) return hit;
  const inst = b64dec(instB64);
  for (const ep of [`${inst}/stream/?id=${origId}`,`${inst}/stream?id=${origId}`,`${inst}/track/stream/?id=${origId}`,`${inst}/url?id=${origId}`]) {
    try {
      const d = await getJson(ep, { "User-Agent": UA }, 6000) as Record<string,unknown>;
      const url = (d?.url ?? d?.stream_url ?? (d?.urls as string[])?.[0]) as string|undefined;
      if (url?.startsWith("http")) {
        const r = { url, format: (d.codec ?? d.format ?? "flac") as string, quality: d.bitDepth ? `${d.bitDepth}bit/${d.sampleRate}kHz` : "lossless" };
        cacheSet(ck, r, 3500); return r;
      }
    } catch { /**/ }
  }
  return null;
}

export async function hifiAlbumDetail(instB64: string, albumId: string): Promise<unknown|null> {
  const ck = `hifi:alb:${instB64}:${albumId}`;
  const hit = cacheGet<unknown>(ck); if (hit) return hit;
  const inst = b64dec(instB64);
  for (const ep of [`${inst}/album/?id=${albumId}`,`${inst}/album?id=${albumId}`,`${inst}/album/tracks/?id=${albumId}&limit=200`]) {
    try {
      const raw = await getJson(ep, { "User-Agent": UA }) as Record<string,unknown>;
      const d   = raw?.data ?? raw;
      const alb = (d as Record<string,unknown>)?.album ?? d;
      const items: Record<string,unknown>[] = ((d as Record<string,unknown>)?.tracks ?? (d as Record<string,unknown>)?.items ?? (alb as Record<string,unknown>)?.tracks ?? []) as Record<string,unknown>[];
      if (!items.length) continue;
      const art = coverUrl((alb as Record<string,unknown>)?.cover as string, 640);
      const an  = (alb as Record<string,unknown>)?.artist ? ((alb as Record<string,unknown>).artist as Record<string,unknown>).name as string : artist(items[0]!);
      const tracks = items.filter(t => t.streamReady !== false).map(t => {
        const dur = normDur(t.duration as number);
        return { id:`hifi_${instB64}_${t.id}`, provider:"com.resonance.universal", title:t.title??"Unknown",
          artists:[{id:null,name:artist(t)||an}], durationSeconds:dur||null, duration:fmtDur(dur), thumbnailURL:art };
      });
      const result = { id:`hifi_album_${instB64}_${albumId}`, provider:"com.resonance.universal",
        title:(alb as Record<string,unknown>)?.title as string??"Unknown Album", artists:[{id:null,name:an}],
        thumbnailURL:art, year:(alb as Record<string,unknown>)?.releaseDate ? String((alb as Record<string,unknown>).releaseDate).slice(0,4):null, tracks };
      cacheSet(ck, result, 3600); return result;
    } catch { /**/ }
  }
  return null;
}

export async function hifiArtistDetail(instB64: string, artistId: string): Promise<unknown|null> {
  const ck = `hifi:art:${instB64}:${artistId}`;
  const hit = cacheGet<unknown>(ck); if (hit) return hit;
  const inst = b64dec(instB64);
  const [infoR, topR, albR] = await Promise.allSettled([
    getJson(`${inst}/artist/?id=${artistId}`, { "User-Agent": UA }),
    getJson(`${inst}/artist/toptracks/?id=${artistId}&limit=20`, { "User-Agent": UA }),
    getJson(`${inst}/artist/albums/?id=${artistId}&limit=50`, { "User-Agent": UA }),
  ]);
  let info: Record<string,unknown> = {};
  if (infoR.status === "fulfilled") { const d = (infoR.value as Record<string,unknown>)?.data ?? infoR.value; info = ((d as Record<string,unknown>)?.artist ?? d) as Record<string,unknown>; }
  const an  = (info.name as string)??"Unknown Artist";
  const art = coverUrl(info.picture as string, 480);
  const topTracks: unknown[] = [];
  if (topR.status === "fulfilled") {
    const td = (topR.value as Record<string,unknown>)?.data ?? topR.value;
    const items = ((td as Record<string,unknown>)?.items ?? (td as Record<string,unknown>)?.tracks ?? (Array.isArray(td)?td:[])) as Record<string,unknown>[];
    for (const t of items.filter(t=>t.streamReady!==false).slice(0,20)) {
      const dur = normDur(t.duration as number);
      topTracks.push({ id:`hifi_${instB64}_${t.id}`, provider:"com.resonance.universal",
        title:t.title??"Unknown", artists:[{id:null,name:artist(t)||an}],
        durationSeconds:dur||null, duration:fmtDur(dur), thumbnailURL:coverUrl((t.album as Record<string,unknown>)?.cover as string)??art });
    }
  }
  const albums: unknown[] = [];
  if (albR.status === "fulfilled") {
    const ad = (albR.value as Record<string,unknown>)?.data ?? albR.value;
    for (const a of (((ad as Record<string,unknown>)?.items ?? (Array.isArray(ad)?ad:[])) as Record<string,unknown>[]).slice(0,50))
      albums.push({ id:`hifi_album_${instB64}_${a.id}`, provider:"com.resonance.universal",
        title:a.title??"Unknown Album", artists:[{id:null,name:an}], thumbnailURL:coverUrl(a.cover as string),
        year:a.releaseDate?String(a.releaseDate).slice(0,4):null });
  }
  const result = { id:`hifi_artist_${instB64}_${artistId}`, provider:"com.resonance.universal", name:an, artworkURL:art, topTracks, albums };
  cacheSet(ck, result, 3600); return result;
}
