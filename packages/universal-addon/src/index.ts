import { defineAddon } from "@resonance-addons/sdk";
import { handleSearch } from "./routes/search";
import { handleStream } from "./routes/stream";
import { handleAlbum } from "./routes/album";
import { handleArtist } from "./routes/artist";
import { handlePlaylist } from "./routes/playlist";

export interface UniversalConfig {
  hifiInstances: string;
  scClientId: string;
  piKey: string;
  piSecret: string;
  taddyKey: string;
  taddyUid: string;
}

export const addon = defineAddon<UniversalConfig>({
  id: "com.resonance.universal",
  name: "Universal Media",
  description: "HiFi lossless · SoundCloud · Internet Archive · LibriVox audiobooks · Podcast Index · Taddy · Live Radio",
  version: "1.4.0",
  icon: { type:"remote", value:"https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/radio.svg" },
  resources: [
    { type:"stream", idPrefixes:["com.resonance.universal","hifi_","sc_","ia_","radio_","pi_ep_","taddy_ep_","lvox_ch_"] },
    { type:"catalog", catalogs:[{id:"search",name:"Search",isDefault:true}] },
  ],
  auth: {
    type: "token",
    label: "Configure Universal Media — only HiFi Instance URLs are required.",
    fields: [
      { key:"hifiInstances", type:"text", title:"HiFi Instance URLs", placeholder:"https://instance1.com,https://instance2.com", isRequired:true },
      { key:"scClientId",    type:"password", title:"SoundCloud Client ID",      placeholder:"Optional",  isRequired:false },
      { key:"piKey",         type:"password", title:"Podcast Index API Key",     placeholder:"Optional",  isRequired:false },
      { key:"piSecret",      type:"password", title:"Podcast Index API Secret",  placeholder:"Optional",  isRequired:false },
      { key:"taddyKey",      type:"password", title:"Taddy API Key",             placeholder:"Optional",  isRequired:false },
      { key:"taddyUid",      type:"text",     title:"Taddy User ID",             placeholder:"Optional",  isRequired:false },
    ],
  },
  behaviorHints: { configurable:true, configurationRequired:true },
  handlers: {
    search:           (cfg, q) => handleSearch(cfg, q),
    resolveStream:    (cfg, id) => handleStream(cfg, id),
    getAlbumDetail:   (cfg, id) => handleAlbum(cfg, id),
    getArtistDetail:  (cfg, id) => handleArtist(cfg, id),
    getPlaylistDetail:(cfg, id) => handlePlaylist(cfg, id),
    getCatalog:       (cfg, id, extra) => handleSearch(cfg, (extra as { search?: string })?.search ?? "", undefined),
  },
});
