import {
  Controller,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PERMISSIONS } from '@event-platform/shared';
import { randomBytes } from 'node:crypto';
import { AppException } from '../../common/app-exception';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import type { TenantAccess } from '../../common/types/authenticated-user';
import { detectImageType } from '../../common/utils/image-type';
import { STORAGE_PORT } from '../../integrations/storage/storage.port';
import type { StoragePort } from '../../integrations/storage/storage.port';
import { WorkspacesService, type BrandingView } from './workspaces.service';

const MAX_BYTES = 1_000_000;
const FIELD_BY_KIND = { logo: 'logoUrl', 'logo-dark': 'logoDarkUrl', favicon: 'faviconUrl' } as const;

interface UploadedBlob {
  buffer: Buffer;
  size: number;
}

/** Logo and favicon uploads: bytes are inspected, stored externally, referenced by URL. */
@Controller('workspaces/:slug/branding/assets')
@TenantScoped('slug')
export class BrandingAssetsController {
  constructor(
    private readonly workspaces: WorkspacesService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  @Post(':kind')
  @RequirePermissions(PERMISSIONS.workspaceManage)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES, files: 1 } }))
  async upload(
    @Param('kind') kind: string,
    @CurrentTenant() tenant: TenantAccess,
    @UploadedFile() file: UploadedBlob | undefined,
  ): Promise<BrandingView> {
    const field = (FIELD_BY_KIND as Record<string, 'logoUrl' | 'logoDarkUrl' | 'faviconUrl'>)[kind];

    if (!field) {
      throw AppException.badRequest('invalid_asset_kind', 'Unknown asset kind.');
    }
    if (!file || file.size === 0) {
      throw AppException.badRequest('file_required', 'Choose an image to upload.');
    }

    const image = detectImageType(file.buffer);
    if (!image) {
      throw AppException.unprocessable(
        'unsupported_image',
        'Upload a PNG, JPEG, WebP or ICO image (SVG is not accepted).',
      );
    }

    const stored = await this.storage.upload({
      key: `${tenant.organizationId}/branding/${kind}-${randomBytes(6).toString('hex')}.${image.extension}`,
      contentType: image.contentType,
      body: file.buffer,
    });

    return this.workspaces.updateBranding({ [field]: stored.url });
  }
}
