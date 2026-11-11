import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common';
import { brandColorSchema, slugSchema } from './workspace';

export const eventStatusSchema = z.enum([
  'DRAFT',
  'PUBLISHED',
  'REGISTRATION_OPEN',
  'REGISTRATION_CLOSED',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
]);

export type EventStatus = z.infer<typeof eventStatusSchema>;

export const eventVisibilitySchema = z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE']);
export type EventVisibility = z.infer<typeof eventVisibilitySchema>;

export const eventFormatSchema = z.enum(['IN_PERSON', 'ONLINE', 'HYBRID']);
export type EventFormat = z.infer<typeof eventFormatSchema>;

const isoDateTimeSchema = z.iso.datetime({ offset: true });

/**
 * Field definitions without defaults. Defaults belong to creation only: if they lived
 * here, `.partial()` would still apply them and a PATCH of `{ name }` would silently
 * reset format and visibility.
 */
const eventFieldsSchema = z.object({
    name: z.string().trim().min(3).max(180),
    slug: slugSchema.optional(),
    description: z.string().trim().max(4000).optional(),
    format: eventFormatSchema,
    visibility: eventVisibilitySchema,
    timeZone: z.string().trim().min(1).max(64),
    startsAt: isoDateTimeSchema,
    endsAt: isoDateTimeSchema,
    venueName: z.string().trim().max(180).optional(),
    venueAddress: z.string().trim().max(400).optional(),
    parentEventId: uuidSchema.optional(),
  });

export const createEventRequestSchema = eventFieldsSchema
  .extend({
    format: eventFormatSchema.default('IN_PERSON'),
    visibility: eventVisibilitySchema.default('PRIVATE'),
  })
  .refine(
  (value) => new Date(value.endsAt) > new Date(value.startsAt),
  {
    message: 'The end must be after the start',
    path: ['endsAt'],
  },
);

export type CreateEventRequest = z.infer<typeof createEventRequestSchema>;

/** Event-level colour overrides. A missing key inherits the workspace branding. */
export const brandOverridesSchema = z.object({
  primaryColor: brandColorSchema.optional(),
  secondaryColor: brandColorSchema.optional(),
  accentColor: brandColorSchema.optional(),
});
export type BrandOverrides = z.infer<typeof brandOverridesSchema>;

/**
 * Updates reuse the same field definitions. Keeping them in a plain ZodObject means
 * `.partial()` works without unwrapping a refined schema.
 */
export const updateEventRequestSchema = eventFieldsSchema
  .partial()
  .omit({ parentEventId: true })
  .extend({ brandOverrides: brandOverridesSchema.nullable().optional() });

export type UpdateEventRequest = z.infer<typeof updateEventRequestSchema>;

/**
 * Lifecycle transitions that are not a publish.
 *
 * They share one route because they differ only by the resulting status; the allowed
 * source statuses live in the server's lifecycle rules.
 */
export const eventTransitionActionSchema = z.enum([
  'unpublish',
  'open-registration',
  'close-registration',
  'complete',
  'cancel',
  'archive',
]);

export type EventTransitionAction = z.infer<typeof eventTransitionActionSchema>;

export const eventTransitionRequestSchema = z.object({
  action: eventTransitionActionSchema,
});

export type EventTransitionRequest = z.infer<typeof eventTransitionRequestSchema>;

export const eventSummarySchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  slug: z.string(),
  name: z.string(),
  status: eventStatusSchema,
  visibility: eventVisibilitySchema,
  format: eventFormatSchema,
  timeZone: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  publishedAt: z.string().nullable(),
  editionCount: z.number().int().optional(),
});

export type EventSummary = z.infer<typeof eventSummarySchema>;

export const eventDetailSchema = eventSummarySchema.extend({
  description: z.string().nullable(),
  venueName: z.string().nullable(),
  venueAddress: z.string().nullable(),
  parentEventId: uuidSchema.nullable(),
  registrationOpensAt: z.string().nullable(),
  registrationClosesAt: z.string().nullable(),
  enabledModules: z.array(z.string()),
  bannerUrl: z.string().nullable(),
  brandOverrides: brandOverridesSchema.nullable(),
});

export type EventDetail = z.infer<typeof eventDetailSchema>;

export const listEventsQuerySchema = paginationQuerySchema.extend({
  status: eventStatusSchema.optional(),
  visibility: eventVisibilitySchema.optional(),
  search: z.string().trim().min(1).max(120).optional(),
});

export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;

export const publicEventSchema = eventDetailSchema.pick({
  id: true,
  slug: true,
  name: true,
  format: true,
  visibility: true,
  timeZone: true,
  startsAt: true,
  endsAt: true,
});

export type PublicEvent = z.infer<typeof publicEventSchema>;

export const setEventModuleRequestSchema = z.object({
  enabled: z.boolean(),
  settings: z.record(z.string(), z.unknown()).optional(),
});
export type SetEventModuleRequest = z.infer<typeof setEventModuleRequestSchema>;

export const eventModuleViewSchema = z.object({
  key: z.string(),
  name: z.string(),
  summary: z.string(),
  priority: z.enum(['core', 'p0', 'p1', 'p2']),
  dependsOn: z.array(z.string()),
  configurable: z.boolean(),
  available: z.boolean(),
  enabled: z.boolean(),
  settings: z.record(z.string(), z.unknown()),
});
export type EventModuleView = z.infer<typeof eventModuleViewSchema>;
