import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import {
  PERMISSIONS,
  saveRegistrationFormRequestSchema,
  type RegistrationForm,
  type SaveRegistrationFormRequest,
} from '@event-platform/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { RegistrationFormService } from './registration-form.service';

/** The event's current registration form. */
@Controller('workspaces/:slug/events/:eventId/registration-form')
@TenantScoped('slug')
export class RegistrationFormController {
  constructor(private readonly forms: RegistrationFormService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.registrationRead)
  show(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
  ): Promise<RegistrationForm | null> {
    return this.forms.show(eventId);
  }

  @Put()
  @RequirePermissions(PERMISSIONS.registrationManage)
  save(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body(new ZodValidationPipe(saveRegistrationFormRequestSchema))
    body: SaveRegistrationFormRequest,
  ): Promise<RegistrationForm> {
    return this.forms.save(eventId, body);
  }
}
