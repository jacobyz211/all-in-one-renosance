import { cacheGet, cacheSet } from "./cache";
import { getJson } from "./http";

export async function radioSearch(q: string): Promise<unknown[]> {
  const ck = `radio:${q}`; const cached = cacheGet<unknown[]>(ck); if (cached) return cached;
  try {
    const data = await getJson(`https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(q)}&limit=12&hidebroken=true&order=votes&reverse=true`,{},6000) as Record<string,unknown>[];
    const stations = Array.isArray(data)?data:[];
    const tracks = stations.map(s => ({ id:`radio_${s.stationuuid}`, provider:"com.resonance.universal",
      title:(s.name as string)??"Unknown Station", artists:[{id:null,name:(s.country as string)??"Radio"}],
      album:s.tags?{id:null,name:(s.tags as string).split(",")[0]}:null,
      durationSeconds:null, duration:null, thumbnailURL:(s.favicon as string)||null }));
    cacheSet(ck, tracks, 300); return tracks;
  } catch { return []; }
}
