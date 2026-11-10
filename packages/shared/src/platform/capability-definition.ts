import type { CapabilityDefinition } from './capabilities';

/** Identity helper that gives every registry entry full type checking. */
export function defineCapability(definition: CapabilityDefinition): CapabilityDefinition {
  return definition;
}
