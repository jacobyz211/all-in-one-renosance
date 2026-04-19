import { cacheGet, cacheSet } from "./cache";
import { getJson } from "./http";
export async function radioSearch(q: string): Promise<unknown[]> {
  const ck=`radio:${q}`; const c=cacheGet<unknown[]>(ck); if(c) return c;
  try{
    const d=await getJson(`https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(q)}&limit=12&hidebroken=true&order=votes&reverse=true`,{},6000) as Record<string,unknown>[];
    const tracks=(Array.isArray(d)?d:[]).map(s=>({id:`radio_${s.stationuuid}`,title:(s.name as string)??"Unknown Station",artist:(s.country as string)??"Radio",album:(s.tags as string)?.split(",")?.[0]??null,duration:null,artworkURL:(s.favicon as string)||null,format:"mp3"}));
    cacheSet(ck,tracks,300); return tracks;
  }catch{return [];}
}
