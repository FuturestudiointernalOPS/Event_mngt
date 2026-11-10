import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import {
  EventFormat,
  EventStatus,
  EventVisibility,
  OrganizationStatus,
  Prisma,
} from '../../database/prisma-client';
import type { EventWithEditionCount, EventWithModules } from './events.mapper';
import {
  NON_PUBLIC_STATUSES,
  PUBLIC_EVENT_CONTEXT_SELECT,
  PUBLIC_VISIBILITIES,
  type PublicEventContextRow,
} from './events.projection';

export interface PublicEventTarget {
  id: string;
  organizationId: string;
  slug: string;
  name: string;
  status: EventStatus;
  visibility: EventVisibility;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
}

export interface CreateEventData {
  organizationId: string;
  createdByUserId: string;
  parentEventId: string | null;
  slug: string;
  name: string;
  description: string | null;
  format: EventFormat;
  visibility: EventVisibility;
  timeZone: string;
  startsAt: Date;
  endsAt: Date;
  venueName: string | null;
  venueAddress: string | null;
  initialModuleKeys: string[];
}

/**
 * The event query surface. It exists because listing (filters, ordering, pagination,
 * aggregate count) and the public projection are genuinely complex; the simple
 * lookups sit here too so all event queries stay in one place.
 */
@Injectable()
export class EventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(
    tx: TenantPrismaClient,
    where: Prisma.EventWhereInput,
    orderBy: Prisma.EventOrderByWithRelationInput,
    skip: number,
    take: number,
  ): Promise<[EventWithEditionCount[], number]> {
    return Promise.all([
      tx.event.findMany({
        where,
        orderBy,
        skip,
        take,
        include: { _count: { select: { editions: true } } },
      }),
      tx.event.count({ where }),
    ]);
  }

  findById(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<EventWithModules | null> {
    return tx.event.findFirst({
      where: { id: eventId, organizationId },
      include: { modules: true },
    });
  }

  findStatus(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<{ id: string; status: EventStatus; visibility: EventVisibility } | null> {
    return tx.event.findFirst({
      where: { id: eventId, organizationId },
      select: { id: true, status: true, visibility: true },
    });
  }

  findSlugConflict(
    tx: TenantPrismaClient,
    organizationId: string,
    slug: string,
  ): Promise<{ id: string } | null> {
    return tx.event.findFirst({
      where: { organizationId, slug },
      select: { id: true },
    });
  }

  findParentForCreate(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<{ id: string; parentEventId: string | null } | null> {
    return tx.event.findFirst({
      where: { id: eventId, organizationId },
      select: { id: true, parentEventId: true },
    });
  }

  create(tx: TenantPrismaClient, data: CreateEventData): Promise<EventWithModules> {
    return tx.event.create({
      data: {
        organizationId: data.organizationId,
        createdByUserId: data.createdByUserId,
        parentEventId: data.parentEventId,
        slug: data.slug,
        name: data.name,
        description: data.description,
        format: data.format,
        visibility: data.visibility,
        timeZone: data.timeZone,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        venueName: data.venueName,
        venueAddress: data.venueAddress,
        modules: {
          create: data.initialModuleKeys.map((moduleKey) => ({ moduleKey, enabled: true })),
        },
      },
      include: { modules: true },
    });
  }

  enablePublishingModule(tx: TenantPrismaClient, eventId: string): Promise<unknown> {
    return tx.eventModule.upsert({
      where: { eventId_moduleKey: { eventId, moduleKey: 'publishing' } },
      create: { eventId, moduleKey: 'publishing', enabled: true, settings: {} },
      update: { enabled: true },
    });
  }

  publish(tx: TenantPrismaClient, eventId: string): Promise<EventWithModules> {
    return tx.event.update({
      where: { id: eventId },
      data: { status: EventStatus.PUBLISHED, publishedAt: new Date() },
      include: { modules: true },
    });
  }

  /**
   * Internal seam for the public registration flow: the event is located from its public
   * slug and the caller gets the organisation, window and lifecycle in one read.
   */
  findPublicTarget(eventSlug: string): Promise<PublicEventTarget | null> {
    return this.prisma.event.findFirst({
      where: {
        slug: eventSlug,
        visibility: { in: PUBLIC_VISIBILITIES },
        status: { notIn: NON_PUBLIC_STATUSES },
        organization: { status: OrganizationStatus.ACTIVE },
      },
      select: {
        id: true,
        organizationId: true,
        slug: true,
        name: true,
        status: true,
        visibility: true,
        registrationOpensAt: true,
        registrationClosesAt: true,
      },
    });
  }

  /**
   * Locate a published event from its public slug.
   *
   * The only public query that runs without organisation context: the event policy
   * allows reading published, non-private events, and the result carries the
   * organisation so the projection can run scoped.
   */
  findPublicEventLocation(
    eventSlug: string,
  ): Promise<{ id: string; organizationId: string } | null> {
    return this.prisma.event.findFirst({
      where: {
        slug: eventSlug,
        visibility: { in: PUBLIC_VISIBILITIES },
        status: { notIn: NON_PUBLIC_STATUSES },
        organization: { status: OrganizationStatus.ACTIVE },
      },
      select: { id: true, organizationId: true },
    });
  }

  /** The public projection for one event, read inside its organisation scope. */
  findPublicContextById(
    tx: TenantPrismaClient,
    eventId: string,
    organizationId: string,
  ): Promise<PublicEventContextRow | null> {
    return tx.event.findFirst({
      where: { id: eventId, organizationId },
      select: PUBLIC_EVENT_CONTEXT_SELECT,
    });
  }
}
