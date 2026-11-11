import { Branding, DEFAULT_BRANDING, Locale } from '@event-platform/shared';
import { toBranding, toLocale } from '../../common/utils/branding';
import { toBrandOverrides } from './events.mapper';
import { EventStatus, EventVisibility, Prisma } from '../../database/prisma-client';

/**
 * The public event read model.
 *
 * Visibility is enforced in the query, never by hiding fields in the client. The select
 * and the mapper live together so the projection cannot drift from what it promises.
 */

export const PUBLIC_VISIBILITIES: EventVisibility[] = [
  EventVisibility.PUBLIC,
  EventVisibility.UNLISTED,
];

export const NON_PUBLIC_STATUSES: EventStatus[] = [
  EventStatus.DRAFT,
  EventStatus.CANCELLED,
  EventStatus.ARCHIVED,
];

export const PUBLIC_EVENT_CONTEXT_SELECT = {
  slug: true,
  name: true,
  description: true,
  format: true,
  visibility: true,
  timeZone: true,
  startsAt: true,
  endsAt: true,
  venueName: true,
  venueAddress: true,
  bannerUrl: true,
  brandOverrides: true,
  organization: {
    select: {
      slug: true,
      name: true,
      branding: true,
      settings: { select: { defaultLocale: true } },
    },
  },
} as const satisfies Prisma.EventSelect;

export type PublicEventContextRow = Prisma.EventGetPayload<{
  select: typeof PUBLIC_EVENT_CONTEXT_SELECT;
}>;

export interface PublicEventContext {
  event: {
    slug: string;
    name: string;
    description: string | null;
    format: string;
    visibility: string;
    timeZone: string;
    startsAt: string;
    endsAt: string;
    venueName: string | null;
    venueAddress: string | null;
    bannerUrl: string | null;
  };
  organization: { slug: string; name: string };
  branding: Branding;
  locale: { default: Locale; supported: Locale[] };
}

export function toPublicContext(row: PublicEventContextRow): PublicEventContext {
  return {
    event: {
      slug: row.slug,
      name: row.name,
      description: row.description,
      format: row.format,
      visibility: row.visibility,
      timeZone: row.timeZone,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      venueName: row.venueName,
      venueAddress: row.venueAddress,
      bannerUrl: row.bannerUrl,
    },
    organization: {
      slug: row.organization.slug,
      name: row.organization.name,
    },
    // Event colours override the workspace's; a missing key inherits it.
    branding: {
      ...(row.organization.branding
        ? toBranding(row.organization.branding)
        : { ...DEFAULT_BRANDING }),
      ...(toBrandOverrides(row.brandOverrides) ?? {}),
    },
    locale: {
      default: toLocale(row.organization.settings?.defaultLocale),
      supported: ['fr', 'en'],
    },
  };
}
