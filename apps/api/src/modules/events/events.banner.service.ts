import { Inject, Injectable } from '@nestjs/common';
import type { EventDetail } from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { AUDIT_ACTIONS } from '../../common/audit/audit.actions';
import { AuditService } from '../../common/audit/audit.service';
import {
  imageContentHash,
  inspectImageUpload,
  type ImageFile,
} from '../../common/uploads/image-upload.rules';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { STORAGE_PORT } from '../../integrations/storage/storage.port';
import type { StoragePort } from '../../integrations/storage/storage.port';
import { toDetail } from './events.mapper';
import { EventsRepository } from './events.repository';

/**
 * The banner behind the public event page.
 *
 * Validated in memory, then stored under a content-addressed key: re-uploading the same
 * file is idempotent and a different file never overwrites the previous one silently.
 * Only the URL is stored, never a credential.
 */
@Injectable()
export class EventBannerService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly events: EventsRepository,
    private readonly audit: AuditService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  async upload(eventId: string, file: ImageFile | undefined): Promise<EventDetail> {
    const detected = inspectImageUpload(file);

    const organizationId = await this.tenantTransaction.withTenant(async (tx, tenant) => {
      const event = await this.events.findStatus(tx, tenant.organizationId, eventId);

      if (!event) {
        throw AppException.notFound('not_found', 'Event not found.');
      }

      return tenant.organizationId;
    });

    // Outside the transaction on purpose: a slow bucket must not hold a database
    // connection, and the row is only touched once the upload has a URL.
    const uploaded = await this.storage.upload({
      key: `${organizationId}/events/${eventId}/banner-${imageContentHash(file!.buffer)}.${detected.extension}`,
      contentType: detected.contentType,
      body: file!.buffer,
    });

    const detail = await this.tenantTransaction.withTenant(async (tx, tenant) => {
      const event = await this.events.findStatus(tx, tenant.organizationId, eventId);

      if (!event) {
        throw AppException.notFound('not_found', 'Event not found.');
      }

      return toDetail(await this.events.update(tx, eventId, { bannerUrl: uploaded.url }));
    });

    await this.audit.record({
      action: AUDIT_ACTIONS.eventUpdated,
      targetType: 'event',
      targetId: eventId,
      metadata: { asset: 'banner' },
    });

    return detail;
  }
}
