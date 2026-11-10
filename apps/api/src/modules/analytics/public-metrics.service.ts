import { Injectable } from '@nestjs/common';
import type { PublicMetrics } from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { EventsService } from '../events/events.service';
import { ModuleRegistryService } from '../module-registry/module-registry.service';
import { buildPublicMetrics } from './public-metrics.rules';
import { PublicMetricsRepository } from './public-metrics.repository';

/**
 * Anonymous event metrics (WP-20).
 *
 * The event is located from its public slug, the `reporting` module is required, and
 * every figure is suppressed and rounded by the pure rules. A disabled reporting module
 * is reported exactly like a missing event.
 */
@Injectable()
export class PublicMetricsService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: PublicMetricsRepository,
    private readonly events: EventsService,
    private readonly modules: ModuleRegistryService,
  ) {}

  async get(eventSlug: string): Promise<PublicMetrics> {
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
          'reporting',
        );

        const [
          registrations,
          categoryCounts,
          categories,
          participants,
          publicProfiles,
          publicInnovations,
        ] = await Promise.all([
          this.repository.approvedRegistrationCount(
            tx,
            target.organizationId,
            target.id,
          ),
          this.repository.approvedCategoryCounts(
            tx,
            target.organizationId,
            target.id,
          ),
          this.repository.listActiveCategories(
            tx,
            target.organizationId,
            target.id,
          ),
          this.repository.participantStats(
            tx,
            target.organizationId,
            target.id,
          ),
          this.repository.publicProfileCount(
            tx,
            target.organizationId,
            target.id,
          ),
          this.repository.publicInnovationCount(
            tx,
            target.organizationId,
            target.id,
          ),
        ]);

        return buildPublicMetrics({
          event: { slug: target.slug, name: target.name },
          registrations,
          categories,
          categoryCounts,
          participants,
          publicProfiles,
          publicInnovations,
        });
      },
    );
  }
}
