import type { AddonDefinition } from "./types";

export function defineAddon<TConfig = Record<string, string>>(def: AddonDefinition<TConfig>) {
  const addon = {
    manifest: {
      id:            def.id,
      name:          def.name,
      description:   def.description,
      version:       def.version,
      icon:          def.icon,
      resources:     def.resources,
      auth:          def.auth,
      config:        def.config,
      behaviorHints: def.behaviorHints,
      capabilities:  def.capabilities,
    },
    handlers: def.handlers,
  };
  (globalThis as Record<string, unknown>).__resonance_addon__ = addon;
  return addon;
}
