export interface AuthField {
  key: string; type: string; title: string;
  placeholder?: string; options?: string[]; defaultValue?: string; isRequired?: boolean;
}
export interface AddonIcon { type: string; value: string; }
export interface CatalogEntry { id: string; name: string; extra?: unknown[]; isDefault?: boolean; }
export interface ResourceDefinition { type: string; idPrefixes?: string[]; catalogs?: CatalogEntry[]; }
export interface AuthDefinition { type: string; label?: string; fields?: AuthField[]; }
export interface BehaviorHints { configurable?: boolean; configurationRequired?: boolean; }
export interface AddonHandlers<T> {
  resolveStream?: (cfg: T, id: string) => Promise<unknown>;
  search?: (cfg: T, q: string, filter?: string, ctx?: unknown) => Promise<unknown[]>;
  getAlbumDetail?: (cfg: T, id: string) => Promise<unknown>;
  getArtistDetail?: (cfg: T, id: string) => Promise<unknown>;
  getPlaylistDetail?: (cfg: T, id: string) => Promise<unknown>;
}
export interface AddonDefinition<T = Record<string, string>> {
  id: string; name: string; description: string; version: string;
  icon?: AddonIcon; resources: ResourceDefinition[];
  auth?: AuthDefinition; behaviorHints?: BehaviorHints;
  handlers: AddonHandlers<T>;
}
