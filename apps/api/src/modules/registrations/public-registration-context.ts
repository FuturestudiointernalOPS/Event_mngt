import { AppException } from '../../common/app-exception';
import { PrismaService } from '../../database/prisma.service';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import { assertRegistrationOpen } from './registration.rules';

export interface PublicEvent {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  status: string;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  consentText: string | null;
  consentVersion: string;
}

/** Looks up a public/unlisted event by slug; private events and unknown slugs are 404. */
export async function findPublicEvent(prisma: PrismaService, eventSlug: string): Promise<PublicEvent> {
  const event = await prisma.event.findFirst({
    where: { slug: eventSlug, visibility: { in: ['PUBLIC', 'UNLISTED'] } },
    select: {
      id: true,
      organizationId: true,
      name: true,
      slug: true,
      status: true,
      registrationOpensAt: true,
      registrationClosesAt: true,
      consentText: true,
      consentVersion: true,
    },
  });

  if (!event) {
    throw AppException.notFound('not_found', 'Event not found.');
  }

  return event;
}

/** Settings of the registration module; refuses when the module is off. */
export async function registrationSettings(
  tx: TenantPrismaClient,
  eventId: string,
): Promise<{ approvalMode: string; requiresConsent: boolean }> {
  const module = await tx.eventModule.findUnique({
    where: { eventId_moduleKey: { eventId, moduleKey: 'registration' } },
    select: { enabled: true, settings: true },
  });

  if (!module?.enabled) {
    throw AppException.notFound('registration_unavailable', 'Registration is not available for this event.');
  }

  const settings = (module.settings ?? {}) as { approvalMode?: string; requiresConsent?: boolean };
  return {
    approvalMode: settings.approvalMode ?? 'manual',
    requiresConsent: settings.requiresConsent ?? true,
  };
}

export function isRegistrationOpen(event: PublicEvent): boolean {
  try {
    assertRegistrationOpen(event, new Date());
    return true;
  } catch {
    return false;
  }
}
