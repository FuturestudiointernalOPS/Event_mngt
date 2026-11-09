import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  PERMISSIONS,
  UpdateBrandingRequest,
  UpdateWorkspaceSettingsRequest,
  WorkspaceContext,
  brandingAssetKindSchema,
  updateBrandingRequestSchema,
  updateWorkspaceSettingsRequestSchema,
  type BrandingAssetKind,
  type BrandingAssetUploadResult,
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
import { BrandingAssetsService } from './branding-assets.service';
import { MAX_BRANDING_ASSET_BYTES, type BrandingAssetFile } from './branding-assets.rules';

@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly assets: BrandingAssetsService,
  ) {}

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

  /**
   * Logo / dark logo / favicon. The type allowlist is checked in the service, but the
   * multipart limit is declared here so an oversized body never reaches the handler.
   */
  @TenantScoped('slug')
  @RequirePermissions(PERMISSIONS.workspaceManage)
  @Post(':slug/branding/assets/:kind')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_BRANDING_ASSET_BYTES } }),
  )
  uploadBrandAsset(
    @Param('kind', new ZodValidationPipe(brandingAssetKindSchema)) kind: BrandingAssetKind,
    @UploadedFile() file: BrandingAssetFile | undefined,
  ): Promise<BrandingAssetUploadResult> {
    return this.assets.upload(kind, file);
  }
}
