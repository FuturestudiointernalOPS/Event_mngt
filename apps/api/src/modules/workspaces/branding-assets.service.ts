import { Inject, Injectable } from '@nestjs/common';
import {
  DEFAULT_BRANDING,
  type Branding,
  type BrandingAssetKind,
  type BrandingAssetUploadResult,
} from '@event-platform/shared';
import { AUDIT_ACTIONS } from '../../common/audit/audit.actions';
import { AuditService } from '../../common/audit/audit.service';
import {
  imageContentHash,
  inspectImageUpload,
  type ImageFile,
} from '../../common/uploads/image-upload.rules';
import { toBranding } from '../../common/utils/branding';
import { TenantContextService } from '../../database/tenant-context.service';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { STORAGE_PORT } from '../../integrations/storage/storage.port';
import type { StoragePort } from '../../integrations/storage/storage.port';
import { brandingAssetKey } from './branding-assets.rules';
import { checkContrast } from './workspaces.service';

/**
 * Logo and favicon uploads.
 *
 * The image is validated in memory, then uploaded under a content-addressed key, so
 * re-uploading the same file is idempotent and a different file never overwrites the
 * previous one silently. The database stores the provider's URL, not a credential.
 */
@Injectable()
export class BrandingAssetsService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly tenantContext: TenantContextService,
    private readonly audit: AuditService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  async upload(
    kind: BrandingAssetKind,
    file: ImageFile | undefined,
  ): Promise<BrandingAssetUploadResult> {
    const detected = inspectImageUpload(file);
    const organizationId = this.tenantContext.getOrThrow().organizationId;
    const hash = imageContentHash(file!.buffer);
    const key = brandingAssetKey(organizationId, kind, hash, detected.extension);

    const uploaded = await this.storage.upload({
      key,
      contentType: detected.contentType,
      body: file!.buffer,
    });

    const view = await this.tenantTransaction.withTenant(async (tx, tenant) => {
      const existing = await tx.workspaceBranding.findUnique({
        where: { organizationId: tenant.organizationId },
      });

      const branding: Branding = existing
        ? toBranding(existing)
        : { ...DEFAULT_BRANDING };

      if (kind === 'logo') {
        branding.logoUrl = uploaded.url;
      } else if (kind === 'logoDark') {
        branding.logoDarkUrl = uploaded.url;
      } else {
        branding.faviconUrl = uploaded.url;
      }

      await tx.workspaceBranding.upsert({
        where: { organizationId: tenant.organizationId },
        create: { organizationId: tenant.organizationId, ...branding },
        update:
          kind === 'logo'
            ? { logoUrl: uploaded.url }
            : kind === 'logoDark'
              ? { logoDarkUrl: uploaded.url }
              : { faviconUrl: uploaded.url },
      });

      return {
        url: uploaded.url,
        kind,
        branding,
        contrastWarnings: checkContrast(branding),
      };
    });

    await this.audit.record({
      action: AUDIT_ACTIONS.brandingUpdated,
      targetType: 'workspace',
      targetId: organizationId,
      metadata: { asset: kind },
    });

    return view;
  }
}
