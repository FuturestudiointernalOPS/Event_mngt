import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EventDetail, PERMISSIONS } from '@event-platform/shared';
import { randomBytes } from 'node:crypto';
import { AppException } from '../../common/app-exception';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import type { TenantAccess } from '../../common/types/authenticated-user';
import { detectImageType } from '../../common/utils/image-type';
import { STORAGE_PORT } from '../../integrations/storage/storage.port';
import type { StoragePort } from '../../integrations/storage/storage.port';
import { EventChangesService } from './event-changes.service';

const MAX_BYTES = 2_000_000;

/** The event banner: validated by real image type and size, stored externally. */
@Controller('workspaces/:slug/events/:eventId/banner')
@TenantScoped('slug')
export class EventBannerController {
  constructor(
    private readonly changes: EventChangesService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  @Post()
  @RequirePermissions(PERMISSIONS.eventManage)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES, files: 1 } }))
  async upload(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @CurrentTenant() tenant: TenantAccess,
    @UploadedFile() file: { buffer: Buffer; size: number } | undefined,
  ): Promise<EventDetail> {
    if (!file || file.size === 0) {
      throw AppException.badRequest('file_required', 'Choose an image to upload.');
    }
    const image = detectImageType(file.buffer);
    if (!image || image.extension === 'ico') {
      throw AppException.unprocessable('unsupported_image', 'Upload a PNG, JPEG or WebP image.');
    }
    const stored = await this.storage.upload({
      key: `${tenant.organizationId}/events/${eventId}/banner-${randomBytes(6).toString('hex')}.${image.extension}`,
      contentType: image.contentType,
      body: file.buffer,
    });
    return this.changes.setBanner(eventId, stored.url);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.eventManage)
  remove(@Param('eventId', new ParseUUIDPipe()) eventId: string): Promise<EventDetail> {
    return this.changes.setBanner(eventId, null);
  }
}
