import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common';
import { slugSchema } from './workspace';

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

const isoDateTimeSchema = z.string().datetime({ offset: true });

export const createEventRequestSchema = z
  .object({
    name: z.string().trim().min(3).max(180),
    slug: slugSchema.optional(),
    description: z.string().trim().max(4000).optional(),
    format: eventFormatSchema.default('IN_PERSON'),
    visibility: eventVisibilitySchema.default('PRIVATE'),
    timeZone: z.string().trim().min(1).max(64),
    startsAt: isoDateTimeSchema,
    endsAt: isoDateTimeSchema,
    venueName: z.string().trim().max(180).optional(),
    venueAddress: z.string().trim().max(400).optional(),
    parentEventId: uuidSchema.optional(),
  })
  .refine((value) => new Date(value.endsAt) > new Date(value.startsAt), {
    message: 'The end must be after the start',
    path: ['endsAt'],
  });

export type CreateEventRequest = z.infer<typeof createEventRequestSchema>;

export const updateEventRequestSchema = createEventRequestSchema.innerType().partial().omit({
  parentEventId: true,
});

export type UpdateEventRequest = z.infer<typeof updateEventRequestSchema>;

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
