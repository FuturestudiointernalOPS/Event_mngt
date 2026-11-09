import { Injectable } from '@nestjs/common';
import {
  Branding,
  CreateEventRequest,
  DEFAULT_BRANDING,
  EventDetail,
  EventSummary,
  ListEventsQuery,
  Locale,
} from '@event-platform/shared';
import {
  Event,
  EventModule,
  EventStatus,
  EventVisibility,
  OrganizationStatus,
  Prisma,
} from '../../database/prisma-client';
import { AppException } from '../../common/app-exception';
import type { PaginatedResult } from '../../common/types/authenticated-user';
import { ensureUniqueSlug, slugify } from '../../common/utils/slug';
import { PrismaService } from '../../database/prisma.service';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { toBranding } from '../workspaces/workspaces.service';

type EventWithModules = Event & { modules: EventModule[] };
type EventWithEditionCount = Event & { _count: { editions: number } };

const SORTABLE_FIELDS = new Set(['name', 'startsAt', 'endsAt', 'createdAt', 'status']);

const PUBLIC_VISIBILITIES: EventVisibility[] = [
  EventVisibility.PUBLIC,
  EventVisibility.UNLISTED,
];

const NON_PUBLIC_STATUSES: EventStatus[] = [
  EventStatus.DRAFT,
  EventStatus.CANCELLED,
  EventStatus.ARCHIVED,
];

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
  };
  organization: { slug: string; name: string };
  branding: Branding;
  locale: { default: Locale; supported: Locale[] };
}

/**
 * Event container: lifecycle, visibility and editions.
 * All tenant-owned access goes through TenantTransactionService with explicit
 * organizationId predicates; row-level security is the second layer.
 */
@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantTransaction: TenantTransactionService,
  ) {}

  async list(query: ListEventsQuery): Promise<PaginatedResult<EventSummary>> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const where: Prisma.EventWhereInput = { organizationId: tenant.organizationId };

      if (query.status) {
        where.status = query.status;
      }
      if (query.visibility) {
        where.visibility = query.visibility;
      }
      if (query.search) {
        where.name = { contains: query.search, mode: 'insensitive' };
      }

      const [rows, total] = await Promise.all([
        tx.event.findMany({
          where,
          orderBy: buildOrderBy(query.sort),
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: { _count: { select: { editions: true } } },
        }),
        tx.event.count({ where }),
      ]);

      const result: PaginatedResult<EventSummary> = {
        items: rows.map(toSummary),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
      return result;
    });
  }

  async create(input: CreateEventRequest, userId: string): Promise<EventDetail> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const slug = input.slug
        ? slugify(input.slug)
        : await ensureUniqueSlug(input.name, async (candidate) => {
            const found = await tx.event.findFirst({
              where: { organizationId: tenant.organizationId, slug: candidate },
              select: { id: true },
            });
            return found !== null;
          });

      const clash = await tx.event.findFirst({
        where: { organizationId: tenant.organizationId, slug },
        select: { id: true },
      });

      if (clash) {
        throw AppException.conflict(
          'slug_taken',
          'An event with this web address already exists in this workspace.',
        );
      }

      if (input.parentEventId) {
        const parent = await tx.event.findFirst({
          where: { id: input.parentEventId, organizationId: tenant.organizationId },
          select: { id: true },
        });
        if (!parent) {
          throw AppException.badRequest(
            'invalid_reference',
            'The parent event does not exist in this workspace.',
          );
        }
      }

      const created = await tx.event.create({
        data: {
          organizationId: tenant.organizationId,
          createdByUserId: userId,
          parentEventId: input.parentEventId ?? null,
          slug,
          name: input.name,
          description: input.description ?? null,
          format: input.format,
          visibility: input.visibility,
          timeZone: input.timeZone,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          venueName: input.venueName ?? null,
          venueAddress: input.venueAddress ?? null,
          modules: {
            create: [
              { moduleKey: 'core', enabled: true },
              { moduleKey: 'reporting', enabled: true },
            ],
          },
        },
        include: { modules: true },
      });

      return toDetail(created);
    });
  }

  async getById(eventId: string): Promise<EventDetail> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const event = await tx.event.findFirst({
        where: { id: eventId, organizationId: tenant.organizationId },
        include: { modules: true },
      });

      if (!event) {
        throw AppException.notFound('not_found', 'Event not found.');
      }

      return toDetail(event);
    });
  }

  async publish(eventId: string): Promise<EventDetail> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const event = await tx.event.findFirst({
        where: { id: eventId, organizationId: tenant.organizationId },
        select: { id: true, status: true, visibility: true },
      });

      if (!event) {
        throw AppException.notFound('not_found', 'Event not found.');
      }

      if (event.status === EventStatus.PUBLISHED) {
        throw AppException.conflict('conflict', 'This event is already published.');
      }

      if (event.status === EventStatus.CANCELLED || event.status === EventStatus.ARCHIVED) {
        throw AppException.unprocessable(
          'invalid_status_transition',
          'A cancelled or archived event cannot be published.',
        );
      }

      // Publishing activates the publishing module without deleting anything.
      if (event.visibility !== 'PRIVATE') {
        await tx.eventModule.upsert({
          where: { eventId_moduleKey: { eventId: event.id, moduleKey: 'publishing' } },
          create: {
            eventId: event.id,
            moduleKey: 'publishing',
            enabled: true,
            settings: {},
          },
          update: { enabled: true },
        });
      }

      const updated = await tx.event.update({
        where: { id: event.id },
        data: { status: EventStatus.PUBLISHED, publishedAt: new Date() },
        include: { modules: true },
      });

      return toDetail(updated);
    });
  }

  /**
   * Public event context. Runs without a session: the projection is explicit and
   * visibility is enforced in the query, never by hiding fields in the client.
   */
  async getPublicContext(eventSlug: string): Promise<PublicEventContext> {
    const event = await this.prisma.event.findFirst({
      where: {
        slug: eventSlug,
        visibility: { in: PUBLIC_VISIBILITIES },
        status: { notIn: NON_PUBLIC_STATUSES },
        organization: { status: OrganizationStatus.ACTIVE },
      },
      select: {
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
        organization: {
          select: {
            slug: true,
            name: true,
            branding: true,
            settings: { select: { defaultLocale: true } },
          },
        },
      },
    });

    if (!event) {
      throw AppException.notFound('not_found', 'Event not found.');
    }

    return {
      event: {
        slug: event.slug,
        name: event.name,
        description: event.description,
        format: event.format,
        visibility: event.visibility,
        timeZone: event.timeZone,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        venueName: event.venueName,
        venueAddress: event.venueAddress,
      },
      organization: {
        slug: event.organization.slug,
        name: event.organization.name,
      },
      branding: event.organization.branding
        ? toBranding(event.organization.branding)
        : { ...DEFAULT_BRANDING },
      locale: {
        default: event.organization.settings?.defaultLocale === 'en' ? 'en' : 'fr',
        supported: ['fr', 'en'],
      },
    };
  }
}

function buildOrderBy(sort: string | undefined): Prisma.EventOrderByWithRelationInput {
  if (!sort) {
    return { startsAt: 'desc' };
  }

  const descending = sort.startsWith('-');
  const field = descending ? sort.slice(1) : sort;

  if (!SORTABLE_FIELDS.has(field)) {
    return { startsAt: 'desc' };
  }

  return { [field]: descending ? 'desc' : 'asc' } as Prisma.EventOrderByWithRelationInput;
}

function toSummary(event: EventWithEditionCount): EventSummary {
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

function toDetail(event: EventWithModules): EventDetail {
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
  };
}
