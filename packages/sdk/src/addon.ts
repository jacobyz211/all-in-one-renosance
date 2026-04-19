import type { AddonDefinition } from "./types";

export function defineAddon<T = Record<string, string>>(def: AddonDefinition<T>) {
  const addon = {
    manifest: {
      id:             def.id,
      name:           def.name,
      description:    def.description,
      version:        def.version,
      icon:           def.icon,
      resources:      def.resources,
      auth:           def.auth,
      behaviorHints:  def.behaviorHints,
    },
    handlers: def.handlers,
  };
  // Store on globalThis so Resonance can find it regardless of module format
  (globalThis as Record<string, unknown>).__resonance_addon__ = addon;
  return addon;
}
