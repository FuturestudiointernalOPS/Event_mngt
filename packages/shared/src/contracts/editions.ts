import { z } from 'zod';
import { paginationQuerySchema } from './common';
import { eventFormatSchema, eventVisibilitySchema } from './events';
import { slugSchema } from './workspace';

/**
 * Editions are event rows linked by `parent_event_id`.
 *
 * Nothing is inherited: an edition states its own slug, dates, venue and visibility.
 * See docs/02-data-model-and-erd.md and WP-06.
 */

const isoDateTimeSchema = z.iso.datetime({ offset: true });

export const createEditionRequestSchema = z
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
  })
  .refine((value) => new Date(value.endsAt) > new Date(value.startsAt), {
    message: 'The end must be after the start',
    path: ['endsAt'],
  });

export type CreateEditionRequest = z.infer<typeof createEditionRequestSchema>;

/** Editions are listed newest first; the caller controls paging only. */
export const listEditionsQuerySchema = paginationQuerySchema.pick({
  page: true,
  pageSize: true,
});

export type ListEditionsQuery = z.infer<typeof listEditionsQuerySchema>;
