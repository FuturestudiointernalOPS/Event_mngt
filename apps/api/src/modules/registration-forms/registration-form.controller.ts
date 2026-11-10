import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import {
  CAPABILITY_KEYS,
  saveRegistrationFormRequestSchema,
  type RegistrationForm,
  type SaveRegistrationFormRequest,
} from '@event-platform/shared';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { RegistrationFormService } from './registration-form.service';

/** The event's current registration form. */
@Controller('workspaces/:slug/events/:eventId/registration-form')
@TenantScoped('slug')
export class RegistrationFormController {
  constructor(private readonly forms: RegistrationFormService) {}

  @Get()
  @RequireCapability(CAPABILITY_KEYS.registrationsViewForm)
  show(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
  ): Promise<RegistrationForm | null> {
    return this.forms.show(eventId);
  }

  @Put()
  @RequireCapability(CAPABILITY_KEYS.registrationsManageForm)
  save(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body(new ZodValidationPipe(saveRegistrationFormRequestSchema))
    body: SaveRegistrationFormRequest,
  ): Promise<RegistrationForm> {
    return this.forms.save(eventId, body);
  }
}
