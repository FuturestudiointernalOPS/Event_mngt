import { Inject, Injectable } from '@nestjs/common';
import { AppException } from '../../common/app-exception';
import { AUDIT_ACTIONS } from '../../common/audit/audit.actions';
import { AuditService } from '../../common/audit/audit.service';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { STORAGE_PORT } from '../../integrations/storage/storage.port';
import type { StoragePort } from '../../integrations/storage/storage.port';
import {
  brandingAssetHash,
  inspectBrandingAsset,
  type BrandingAssetFile,
} from './event-banner.rules';

/** Banner upload: validated in memory, stored under a content-addressed key. */
@Injectable()
export class EventBannerService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly audit: AuditService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  async upload(eventId: string, file: BrandingAssetFile | undefined): Promise<{ bannerUrl: string }> {
    const detected = inspectBrandingAsset(file);

    const bannerUrl = await this.tenantTransaction.withTenant(async (tx, tenant) => {
      const event = await tx.event.findFirst({
        where: { id: eventId, organizationId: tenant.organizationId },
        select: { id: true },
      });

      if (!event) {
        throw AppException.notFound('not_found', 'Event not found.');
      }

      const key = `${tenant.organizationId}/events/${eventId}/banner-${brandingAssetHash(file!.buffer)}.${detected.extension}`;
      const uploaded = await this.storage.upload({
        key,
        contentType: detected.contentType,
        body: file!.buffer,
      });

      await tx.event.update({
        where: { id: eventId, organizationId: tenant.organizationId },
        data: { bannerUrl: uploaded.url },
      });

      return uploaded.url;
    });

    await this.audit.record({
      action: AUDIT_ACTIONS.eventUpdated,
      targetType: 'event',
      targetId: eventId,
      metadata: { asset: 'banner' },
    });

    return { bannerUrl };
  }
}
