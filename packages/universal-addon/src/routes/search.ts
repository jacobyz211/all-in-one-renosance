import type { UniversalConfig } from "../index";
import { hifiSearch, getInstances } from "../hifi";
import { scSearch } from "../soundcloud";
import { iaSearch } from "../internetarchive";
import { radioSearch } from "../radio";
import { librivoxSearch } from "../librivox";
import { podcastIndexSearch, taddySearch } from "../podcasts";

export async function handleSearch(cfg: UniversalConfig, q: string): Promise<unknown[]> {
  if (!q.trim()) return [];
  const insts = getInstances(cfg.hifiInstances);
  const inst  = insts.length ? insts[Math.floor(Math.random()*insts.length)]! : "";
  const isPod  = /podcast|episode|serial|npr|radiolab|huberman|crime junkie|rogan|fridman|conan|armchair/i.test(q);
  const isRadio = /\bfm\b|radio|station|lofi|lo-fi|chillhop|ambient|bbc/i.test(q);
  const isBook  = /audiobook|librivox|sherlock|austen|dickens|tolkien|public domain/i.test(q);

  const [hifi,sc,ia,radio,lvox,pi,taddy] = await Promise.allSettled([
    inst ? hifiSearch(inst,q) : Promise.resolve({tracks:[],albums:[],artists:[]}),
    scSearch(q, cfg.scClientId||undefined),
    iaSearch(q),
    radioSearch(q),
    librivoxSearch(q),
    podcastIndexSearch(q, cfg.piKey||"", cfg.piSecret||""),
    taddySearch(q, cfg.taddyKey||"", cfg.taddyUid||""),
  ]);

  const hR = hifi.status==="fulfilled"  ? hifi.value  : {tracks:[],albums:[],artists:[]};
  const sR = sc.status==="fulfilled"    ? sc.value    : [];
  const iR = ia.status==="fulfilled"    ? ia.value    : {tracks:[],albums:[]};
  const rR = radio.status==="fulfilled" ? radio.value : [];
  const lR = lvox.status==="fulfilled"  ? lvox.value  : {tracks:[],albums:[]};
  const pR = pi.status==="fulfilled"    ? pi.value    : {tracks:[],albums:[]};
  const tR = taddy.status==="fulfilled" ? taddy.value : {tracks:[],albums:[]};

  const results: unknown[] = [];
  const T = (a: unknown[]) => a.forEach(x => results.push({type:"track",...(x as object)}));
  const A = (a: unknown[]) => a.forEach(x => results.push({type:"album",...(x as object)}));
  const Ar = (a: unknown[]) => a.forEach(x => results.push({type:"artist",...(x as object)}));

  if (isPod)   { T([...pR.tracks,...tR.tracks,...sR,...hR.tracks]); A([...pR.albums,...tR.albums,...hR.albums]); Ar(hR.artists); }
  else if (isRadio) { T([...rR,...sR,...hR.tracks]); A(hR.albums); Ar(hR.artists); }
  else if (isBook)  { A([...lR.albums,...iR.albums,...hR.albums]); T([...iR.tracks,...hR.tracks]); }
  else { T([...hR.tracks,...sR,...iR.tracks,...rR]); A([...hR.albums,...lR.albums,...iR.albums]); Ar(hR.artists); }

  return results.slice(0,60);
}
