import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import {
  PlatformModuleView,
  PlatformOverview,
  SetPlatformModuleRequest,
  setPlatformModuleSchema,
  SetOrganisationStatusRequest,
  setOrganisationStatusSchema,
} from '@event-platform/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PlatformService } from './platform.service';

@Controller('platform')
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthenticatedUser): Promise<PlatformOverview> {
    return this.platform.overview(user.id);
  }

  @Put('organizations/:id/status')
  @HttpCode(HttpStatus.NO_CONTENT)
  setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(setOrganisationStatusSchema)) body: SetOrganisationStatusRequest,
  ): Promise<void> {
    return this.platform.setStatus(user.id, id, body);
  }

  @Get('modules')
  modules(@CurrentUser() user: AuthenticatedUser): Promise<PlatformModuleView[]> {
    return this.platform.listModules(user.id);
  }

  @Put('modules/:key')
  @HttpCode(HttpStatus.NO_CONTENT)
  setModule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body(new ZodValidationPipe(setPlatformModuleSchema)) body: SetPlatformModuleRequest,
  ): Promise<void> {
    return this.platform.setModuleAvailability(user.id, key, body.available);
  }
}
