import type { TenantContext } from '../database/tenant-context.service';

export interface RetentionDeps {
  /** Organisations that configured a retention period. */
  listOrganizations(): Promise<{ organizationId: string; retentionMonths: number }[]>;
  /** Runs the purge inside that organisation's tenant scope. */
  purge(context: TenantContext): Promise<{ erased: number }>;
  onError?(organizationId: string, error: unknown): void;
}

/**
 * Daily retention sweep. One organisation failing must not stop the others, so errors are
 * collected and reported per organisation rather than thrown.
 */
export async function runRetentionSweep(deps: RetentionDeps): Promise<{ organisations: number; erased: number; failed: number }> {
  const organisations = await deps.listOrganizations();
  let erased = 0;
  let failed = 0;

  for (const { organizationId } of organisations) {
    try {
      const result = await deps.purge({ organizationId, userId: '', membershipId: '', permissions: [] });
      erased += result.erased;
    } catch (error) {
      failed += 1;
      deps.onError?.(organizationId, error);
    }
  }

  return { organisations: organisations.length, erased, failed };
}
