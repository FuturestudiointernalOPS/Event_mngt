import { Injectable } from '@nestjs/common';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import { RegistrationStatus } from '../../database/prisma-client';
import { erasedPerson } from './registrations.erasure';

/** Retention and erasure queries: finding expired people and destroying their identity. */
@Injectable()
export class RegistrationsErasureRepository {
  /**
   * People of this organisation whose every registration belongs to an event that ended
   * before the cut-off, and who have not been erased already.
   */
  async findExpiredPersonIds(
    tx: TenantPrismaClient,
    organizationId: string,
    cutoff: Date,
  ): Promise<string[]> {
    const people = await tx.person.findMany({
      where: {
        organizationId,
        email: { not: { endsWith: '@erased.invalid' } },
        registrations: {
          some: {},
          every: { event: { endsAt: { lt: cutoff } } },
        },
      },
      select: { id: true },
    });

    return people.map((person) => person.id);
  }

  async erasePersonData(
    tx: TenantPrismaClient,
    organizationId: string,
    personId: string,
  ): Promise<number> {
    const registrations = await tx.registration.findMany({
      where: { organizationId, personId },
      select: { id: true },
    });
    const registrationIds = registrations.map((row) => row.id);

    if (registrationIds.length === 0) {
      return 0;
    }

    await tx.registrationAnswer.deleteMany({
      where: { organizationId, registrationId: { in: registrationIds } },
    });
    await tx.consentRecord.updateMany({
      where: { organizationId, registrationId: { in: registrationIds } },
      data: { ipAddress: null },
    });

    // The listing keeps its own content, so it has to go explicitly: the profile foreign
    // key is nullable, and deleting the profile would only detach it.
    const profiles = await tx.participantProfile.findMany({
      where: { organizationId, registrationId: { in: registrationIds } },
      select: { id: true },
    });
    const profileIds = profiles.map((row) => row.id);

    if (profileIds.length > 0) {
      await tx.innovation.deleteMany({
        where: { organizationId, participantProfileId: { in: profileIds } },
      });
    }

    await tx.participantProfile.deleteMany({
      where: { organizationId, registrationId: { in: registrationIds } },
    });
    await tx.registration.updateMany({
      where: {
        organizationId,
        personId,
        status: { in: [RegistrationStatus.PENDING, RegistrationStatus.APPROVED] },
      },
      data: { status: RegistrationStatus.CANCELLED },
    });
    const updated = await tx.person.updateMany({
      where: { id: personId, organizationId },
      data: erasedPerson(personId),
    });

    return updated.count;
  }
}
