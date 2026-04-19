import type { AddonDefinition } from "./types";
export function defineAddon<T = Record<string, string>>(def: AddonDefinition<T>) {
  const manifest = { id: def.id, name: def.name, description: def.description,
    version: def.version, icon: def.icon, resources: def.resources,
    auth: def.auth, behaviorHints: def.behaviorHints };
  const addon = { manifest, handlers: def.handlers };
  (globalThis as Record<string, unknown>).__resonance_addon__ = addon;
  return addon;
}
