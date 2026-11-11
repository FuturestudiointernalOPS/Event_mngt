import type { UpdateEventRequest } from '@event-platform/shared';
import { Prisma } from '../../database/prisma-client';
import { slugify } from '../../common/utils/slug';

/**
 * Request → database update, field by field.
 *
 * An absent key means "leave it alone". The status is never writable here: transitions own
 * it. A `brandOverrides` object clears the three colours it does not mention, so "missing
 * colour" and "inherit the workspace" stay the same thing, and an explicit null clears all
 * three.
 */
export function toEventUpdate(input: UpdateEventRequest): Prisma.EventUpdateInput {
  return {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.format !== undefined && { format: input.format }),
    ...(input.visibility !== undefined && { visibility: input.visibility }),
    ...(input.timeZone !== undefined && { timeZone: input.timeZone }),
    ...(input.startsAt !== undefined && { startsAt: new Date(input.startsAt) }),
    ...(input.endsAt !== undefined && { endsAt: new Date(input.endsAt) }),
    ...(input.venueName !== undefined && { venueName: input.venueName }),
    ...(input.venueAddress !== undefined && { venueAddress: input.venueAddress }),
    ...(input.slug !== undefined && { slug: slugify(input.slug) }),
    ...(input.brandOverrides !== undefined && {
      brandPrimaryColor: input.brandOverrides?.primaryColor ?? null,
      brandSecondaryColor: input.brandOverrides?.secondaryColor ?? null,
      brandAccentColor: input.brandOverrides?.accentColor ?? null,
    }),
  };
}
