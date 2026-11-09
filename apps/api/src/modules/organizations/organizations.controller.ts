import { Body, Controller, Post } from '@nestjs/common';
import {
  CreateOrganizationRequest,
  createOrganizationRequestSchema,
} from '@event-platform/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { OrganizationsService, type CreatedOrganization } from './organizations.service';

/** Any signed-in user may create a workspace; they become its first administrator. */
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createOrganizationRequestSchema)) body: CreateOrganizationRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CreatedOrganization> {
    return this.organizations.create(body, user.id);
  }
}
