import { z } from 'zod';
import { modulePrioritySchema } from '../platform/module-registry';

/**
 * Module registry contracts.
 *
 * The catalogue is the shared registry, projected without its settings schemas (a Zod
 * type is not a wire shape). The API validates settings against the same definitions.
 * See docs/06-module-registry.md.
 */

export const moduleCatalogueEntrySchema = z.object({
  key: z.string(),
  name: z.string(),
  summary: z.string(),
  priority: modulePrioritySchema,
  dependsOn: z.array(z.string()),
  requiredPermissions: z.array(z.string()),
  configurable: z.boolean(),
});

export type ModuleCatalogueEntry = z.infer<typeof moduleCatalogueEntrySchema>;

export const eventModuleSchema = z.object({
  key: z.string(),
  enabled: z.boolean(),
  settings: z.unknown().nullable(),
});

export type EventModule = z.infer<typeof eventModuleSchema>;

export const eventModuleChangeSchema = z.object({
  key: z.string().trim().min(1).max(60),
  enabled: z.boolean(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export type EventModuleChange = z.infer<typeof eventModuleChangeSchema>;

export const updateEventModulesRequestSchema = z.object({
  modules: z.array(eventModuleChangeSchema).min(1).max(50),
});

export type UpdateEventModulesRequest = z.infer<typeof updateEventModulesRequestSchema>;

/** A safe settings view: parsed defaults are returned, never the raw input. */
export const eventModulesResponseSchema = z.array(eventModuleSchema);

export type EventModulesResponse = z.infer<typeof eventModulesResponseSchema>;
