import { Injectable } from '@nestjs/common';
import type { PurgeExpiredResult } from '@event-platform/shared';
import { AUDIT_ACTIONS } from '../../common/audit/audit.actions';
import { AuditService } from '../../common/audit/audit.service';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { retentionCutoff } from './registrations.retention';
import { RegistrationsErasureRepository } from './registrations-erasure.repository';

/**
 * Data retention: once the workspace's retention period has passed since an event ended,
 * the personal data of people who took part only in expired events is erased with the
 * same routine as an erasure request. Counts and reports survive; identities do not.
 */
@Injectable()
export class RegistrationsRetentionService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: RegistrationsErasureRepository,
    private readonly audit: AuditService,
  ) {}

  async purgeExpired(dryRun: boolean, now: Date = new Date()): Promise<PurgeExpiredResult> {
    const result = await this.tenantTransaction.withTenant(async (tx, tenant) => {
      const settings = await tx.workspaceSettings.findUnique({
        where: { organizationId: tenant.organizationId },
        select: { retentionMonths: true },
      });
      const months = settings?.retentionMonths ?? null;

      if (months === null) {
        return { dryRun, retentionMonths: null, cutoff: null, people: 0 };
      }

      const cutoff = retentionCutoff(now, months);
      const ids = await this.repository.findExpiredPersonIds(tx, tenant.organizationId, cutoff);

      if (!dryRun) {
        for (const personId of ids) {
          await this.repository.erasePersonData(tx, tenant.organizationId, personId);
        }
      }

      return { dryRun, retentionMonths: months, cutoff: cutoff.toISOString(), people: ids.length };
    });

    if (!dryRun && result.people > 0) {
      await this.audit.record({
        action: AUDIT_ACTIONS.retentionPurged,
        targetType: 'workspace',
        targetId: null,
        metadata: { people: result.people, retentionMonths: result.retentionMonths },
      });
    }

    return result;
  }
}
