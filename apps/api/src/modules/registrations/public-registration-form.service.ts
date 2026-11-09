import { Injectable } from '@nestjs/common';
import type { FieldView, PublicRegistrationForm } from '@event-platform/shared';
import { RegistrationStatus } from '../../database/prisma-client';
import { PrismaService } from '../../database/prisma.service';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import {
  findPublicEvent,
  isRegistrationOpen,
  registrationSettings,
} from './public-registration-context';

const COUNTED = [RegistrationStatus.PENDING, RegistrationStatus.CONFIRMED];

/** The public read model of an event's registration form. */
@Injectable()
export class PublicRegistrationFormService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantTransaction: TenantTransactionService,
  ) {}

  async getForm(eventSlug: string): Promise<PublicRegistrationForm> {
    const event = await findPublicEvent(this.prisma, eventSlug);

    return this.tenantTransaction.withOrganization(event.organizationId, null, async (tx) => {
      const settings = await registrationSettings(tx, event.id);
      const [categories, fields] = await Promise.all([
        tx.participantCategory.findMany({
          where: { organizationId: event.organizationId, eventId: event.id, isActive: true },
          orderBy: [{ position: 'asc' }, { name: 'asc' }],
          include: { _count: { select: { registrations: { where: { status: { in: COUNTED } } } } } },
        }),
        tx.registrationField.findMany({
          where: { organizationId: event.organizationId, eventId: event.id },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          include: { category: { select: { key: true } } },
        }),
      ]);

      return {
        event: { slug: event.slug, name: event.name, registrationOpen: isRegistrationOpen(event) },
        consent: {
          text: event.consentText,
          version: event.consentVersion,
          required: settings.requiresConsent,
        },
        categories: categories.map((c) => ({
          key: c.key,
          name: c.name,
          description: c.description,
          full: c.capacity !== null && c._count.registrations >= c.capacity,
        })),
        fields: fields.map(
          (f): FieldView => ({
            id: f.id,
            key: f.key,
            label: f.label,
            type: f.type,
            required: f.required,
            options: (f.options as string[] | null) ?? null,
            categoryKey: f.category?.key ?? null,
            position: f.position,
          }),
        ),
      };
    });
  }
}
