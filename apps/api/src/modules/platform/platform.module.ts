import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PlatformOrganizationsController } from './platform-organizations.controller';
import { PlatformOrganizationsRepository } from './platform-organizations.repository';
import { PlatformOrganizationsService } from './platform-organizations.service';

/** Cross-tenant organisation oversight and lifecycle (platform administrators only). */
@Module({
  imports: [OrganizationsModule],
  controllers: [PlatformOrganizationsController],
  providers: [PlatformOrganizationsService, PlatformOrganizationsRepository],
})
export class PlatformModule {}
