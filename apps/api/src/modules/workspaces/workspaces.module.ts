import { Module } from '@nestjs/common';
import { BrandingAssetsService } from './branding-assets.service';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  controllers: [WorkspacesController],
  providers: [WorkspacesService, BrandingAssetsService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
