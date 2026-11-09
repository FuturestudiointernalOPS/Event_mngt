import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import {
  EventModuleView,
  PERMISSIONS,
  SetEventModuleRequest,
  setEventModuleRequestSchema,
} from '@event-platform/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EventModulesService } from './event-modules.service';

@Controller('workspaces/:slug/events/:eventId/modules')
@TenantScoped('slug')
export class EventModulesController {
  constructor(private readonly modules: EventModulesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.eventRead)
  list(@Param('eventId', new ParseUUIDPipe()) eventId: string): Promise<EventModuleView[]> {
    return this.modules.list(eventId);
  }

  @Put(':moduleKey')
  @RequirePermissions(PERMISSIONS.moduleManage)
  set(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('moduleKey') moduleKey: string,
    @Body(new ZodValidationPipe(setEventModuleRequestSchema)) body: SetEventModuleRequest,
  ): Promise<EventModuleView[]> {
    return this.modules.set(eventId, moduleKey, body);
  }
}
