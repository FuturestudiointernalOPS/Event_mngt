import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import {
  CAPABILITY_KEYS,
  updateEventModulesRequestSchema,
  type EventModule,
  type ModuleCatalogueEntry,
  type UpdateEventModulesRequest,
} from '@event-platform/shared';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ModuleRegistryService } from './module-registry.service';

/**
 * Catalogue and event activation.
 *
 * The catalogue needs only a signed-in user; the event routes resolve the workspace
 * from the verified membership, exactly like the rest of the tenant surface.
 */
@Controller()
export class ModuleRegistryController {
  constructor(private readonly modules: ModuleRegistryService) {}

  @Get('modules')
  catalogue(): ModuleCatalogueEntry[] {
    return this.modules.catalogue();
  }

  @TenantScoped('slug')
  @RequireCapability(CAPABILITY_KEYS.eventsViewModules)
  @Get('workspaces/:slug/events/:eventId/modules')
  list(@Param('eventId', new ParseUUIDPipe()) eventId: string): Promise<EventModule[]> {
    return this.modules.list(eventId);
  }

  @TenantScoped('slug')
  @RequireCapability(CAPABILITY_KEYS.eventsManageModules)
  @Patch('workspaces/:slug/events/:eventId/modules')
  update(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body(new ZodValidationPipe(updateEventModulesRequestSchema))
    body: UpdateEventModulesRequest,
  ): Promise<EventModule[]> {
    return this.modules.update(eventId, body);
  }
}
