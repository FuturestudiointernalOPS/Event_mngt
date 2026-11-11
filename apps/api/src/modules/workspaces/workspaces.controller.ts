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
  CAPABILITY_KEYS,
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
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { MAX_IMAGE_BYTES, type ImageFile } from '../../common/uploads/image-upload.rules';
import {
  BrandingView,
  WorkspaceSettingsView,
  WorkspacesService,
} from './workspaces.service';
import { BrandingAssetsService } from './branding-assets.service';

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
  @RequireCapability(CAPABILITY_KEYS.organizationView)
  @Get(':slug/settings')
  settings(): Promise<WorkspaceSettingsView> {
    return this.workspacesService.getSettings();
  }

  @TenantScoped('slug')
  @RequireCapability(CAPABILITY_KEYS.organizationEdit)
  @Patch(':slug/settings')
  updateSettings(
    @Body(new ZodValidationPipe(updateWorkspaceSettingsRequestSchema))
    body: UpdateWorkspaceSettingsRequest,
  ): Promise<WorkspaceSettingsView> {
    return this.workspacesService.updateSettings(body);
  }

  @TenantScoped('slug')
  @RequireCapability(CAPABILITY_KEYS.organizationView)
  @Get(':slug/branding')
  branding(): Promise<BrandingView> {
    return this.workspacesService.getBranding();
  }

  @TenantScoped('slug')
  @RequireCapability(CAPABILITY_KEYS.organizationManageBranding)
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
  @RequireCapability(CAPABILITY_KEYS.organizationManageBranding)
  @Post(':slug/branding/assets/:kind')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }),
  )
  uploadBrandAsset(
    @Param('kind', new ZodValidationPipe(brandingAssetKindSchema)) kind: BrandingAssetKind,
    @UploadedFile() file: ImageFile | undefined,
  ): Promise<BrandingAssetUploadResult> {
    return this.assets.upload(kind, file);
  }
}
