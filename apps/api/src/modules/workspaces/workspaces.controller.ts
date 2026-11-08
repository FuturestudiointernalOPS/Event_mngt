import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import {
  PERMISSIONS,
  UpdateBrandingRequest,
  UpdateWorkspaceSettingsRequest,
  WorkspaceContext,
  updateBrandingRequestSchema,
  updateWorkspaceSettingsRequestSchema,
} from '@event-platform/shared';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  BrandingView,
  WorkspaceSettingsView,
  WorkspacesService,
} from './workspaces.service';

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  /**
   * Public: the SPA resolves branding before rendering a tenant shell.
   * Returns a public projection only — no members, contacts or internal ids.
   */
  @Public()
  @Get(':slug/context')
  context(@Param('slug') slug: string): Promise<WorkspaceContext> {
    return this.workspacesService.getPublicContext(slug);
  }

  @TenantScoped('slug')
  @RequirePermissions(PERMISSIONS.workspaceRead)
  @Get(':slug/settings')
  settings(): Promise<WorkspaceSettingsView> {
    return this.workspacesService.getSettings();
  }

  @TenantScoped('slug')
  @RequirePermissions(PERMISSIONS.workspaceManage)
  @Patch(':slug/settings')
  updateSettings(
    @Body(new ZodValidationPipe(updateWorkspaceSettingsRequestSchema))
    body: UpdateWorkspaceSettingsRequest,
  ): Promise<WorkspaceSettingsView> {
    return this.workspacesService.updateSettings(body);
  }

  @TenantScoped('slug')
  @RequirePermissions(PERMISSIONS.workspaceRead)
  @Get(':slug/branding')
  branding(): Promise<BrandingView> {
    return this.workspacesService.getBranding();
  }

  @TenantScoped('slug')
  @RequirePermissions(PERMISSIONS.workspaceManage)
  @Patch(':slug/branding')
  updateBranding(
    @Body(new ZodValidationPipe(updateBrandingRequestSchema))
    body: UpdateBrandingRequest,
  ): Promise<BrandingView> {
    return this.workspacesService.updateBranding(body);
  }
}
