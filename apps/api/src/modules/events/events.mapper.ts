import type { EventDetail, EventSummary } from '@event-platform/shared';
import type { Event, EventModule } from '../../database/prisma-client';

/** Row shapes the mappers accept. Named so the Prisma payload stays in one place. */
export type EventWithModules = Event & { modules: EventModule[] };
export type EventWithEditionCount = Event & { _count: { editions: number } };

export function toSummary(event: EventWithEditionCount): EventSummary {
  return {
    id: event.id,
    organizationId: event.organizationId,
    slug: event.slug,
    name: event.name,
    status: event.status,
    visibility: event.visibility,
    format: event.format,
    timeZone: event.timeZone,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    publishedAt: event.publishedAt ? event.publishedAt.toISOString() : null,
    editionCount: event._count.editions,
  };
}

export function toDetail(event: EventWithModules): EventDetail {
  return {
    id: event.id,
    organizationId: event.organizationId,
    slug: event.slug,
    name: event.name,
    status: event.status,
    visibility: event.visibility,
    format: event.format,
    timeZone: event.timeZone,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    publishedAt: event.publishedAt ? event.publishedAt.toISOString() : null,
    description: event.description,
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    parentEventId: event.parentEventId,
    registrationOpensAt: event.registrationOpensAt
      ? event.registrationOpensAt.toISOString()
      : null,
    registrationClosesAt: event.registrationClosesAt
      ? event.registrationClosesAt.toISOString()
      : null,
    enabledModules: event.modules.filter((module) => module.enabled).map((m) => m.moduleKey),
    // The schema has no banner column and no per-event branding overrides yet. The contract
    // keeps the fields so the client shape is stable; the server reports them as absent.
    bannerUrl: null,
    brandOverrides: null,
  };
}
