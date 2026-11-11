import { Injectable } from '@nestjs/common';
import type { PublicShowcase } from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { EventsService } from '../events/events.service';
import { ModuleRegistryService } from '../module-registry/module-registry.service';
import { ParticipantProfilesRepository } from './participant-profiles.repository';
import {
  toPublicInnovation,
  toPublicParticipantProfile,
} from './profiles.mapper';
import { ShowcaseRepository } from './showcase.repository';

/**
 * The anonymous showcase (WP-14). Approved and public only, no contact details, and a
 * disabled showcase module is reported exactly like a missing event.
 */
@Injectable()
export class PublicShowcaseService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly profiles: ParticipantProfilesRepository,
    private readonly showcase: ShowcaseRepository,
    private readonly events: EventsService,
    private readonly modules: ModuleRegistryService,
  ) {}

  async get(eventSlug: string): Promise<PublicShowcase> {
    const target = await this.events.findPublicTarget(eventSlug);

    if (!target) {
      throw AppException.notFound('not_found', 'Event not found.');
    }

    return this.tenantTransaction.withOrganizationScope(
      target.organizationId,
      async (tx) => {
        await this.modules.requireEnabledSettings(
          tx,
          target.organizationId,
          target.id,
          'showcase',
        );

        const [profiles, innovations] = await Promise.all([
          this.profiles.listPublic(tx, target.organizationId, target.id),
          this.showcase.listPublic(tx, target.organizationId, target.id),
        ]);

        return {
          profiles: profiles.map(toPublicParticipantProfile),
          innovations: innovations.map(toPublicInnovation),
        };
      },
    );
  }
}
