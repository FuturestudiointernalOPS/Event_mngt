import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  PERMISSIONS,
  createConsentDocumentRequestSchema,
  type ConsentDocument,
  type CreateConsentDocumentRequest,
} from '@event-platform/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ConsentService } from './consent.service';

/**
 * Consent wording for one event. Records are written by registration submission, not
 * here: there is deliberately no route that edits or deletes evidence.
 */
@Controller('workspaces/:slug/events/:eventId/consent-documents')
@TenantScoped('slug')
export class ConsentController {
  constructor(private readonly consent: ConsentService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.registrationRead)
  list(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
  ): Promise<ConsentDocument[]> {
    return this.consent.listForEvent(eventId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.registrationManage)
  create(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body(new ZodValidationPipe(createConsentDocumentRequestSchema))
    body: CreateConsentDocumentRequest,
  ): Promise<ConsentDocument> {
    return this.consent.createDocument(eventId, body);
  }
}
