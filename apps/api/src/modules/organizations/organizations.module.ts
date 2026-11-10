import { Module } from '@nestjs/common';
import { OrganizationProvisioningService } from './organization-provisioning.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsRepository } from './organizations.repository';
import { OrganizationsService } from './organizations.service';

/** Self-service organisation onboarding. The provisioning service is exported for the
 * platform administration module, which creates a workspace on behalf of an owner. */
@Module({
  controllers: [OrganizationsController],
  providers: [
    OrganizationsService,
    OrganizationProvisioningService,
    OrganizationsRepository,
  ],
  exports: [OrganizationProvisioningService],
})
export class OrganizationsModule {}
