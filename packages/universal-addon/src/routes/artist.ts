import type { UniversalConfig } from "../index";
import { hifiArtistDetail } from "../hifi";

export async function handleArtist(_cfg: UniversalConfig, id: string): Promise<unknown> {
  if (id.startsWith("hifi_artist_")) {
    const inner = id.slice(12); const sep = inner.indexOf("_"); if (sep===-1) throw new Error("Invalid HiFi artist ID");
    const result = await hifiArtistDetail(inner.slice(0,sep), inner.slice(sep+1));
    if (!result) throw new Error("HiFi artist not found"); return result;
  }
  throw new Error(`Unknown artist ID prefix: ${id}`);
}
