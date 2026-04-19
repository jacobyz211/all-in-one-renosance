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
    // Spread all handlers AND attach them directly on the addon object
    // so Resonance can find them however it looks (addon.handlers.X or addon.X)
    handlers: {
      ...def.handlers,
      // Mirror top-level for any direct property access pattern
    },
    // Also expose handlers at top level
    ...def.handlers,
  };
  (globalThis as Record<string, unknown>).__resonance_addon__ = addon;
  return addon;
}
