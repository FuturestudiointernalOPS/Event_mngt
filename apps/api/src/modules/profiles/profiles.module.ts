import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { ModuleRegistryModule } from '../module-registry/module-registry.module';
import { OrganizationProfileController } from './organization-profile.controller';
import { OrganizationProfileRepository } from './organization-profile.repository';
import { OrganizationProfileService } from './organization-profile.service';
import { ParticipantProfilesController } from './participant-profiles.controller';
import { ParticipantProfilesRepository } from './participant-profiles.repository';
import { ParticipantProfilesService } from './participant-profiles.service';
import { PublicShowcaseController } from './public-showcase.controller';
import { PublicShowcaseService } from './public-showcase.service';
import { ShowcaseController } from './showcase.controller';
import { ShowcaseRepository } from './showcase.repository';
import { ShowcaseService } from './showcase.service';

@Module({
  imports: [EventsModule, ModuleRegistryModule],
  controllers: [
    ParticipantProfilesController,
    OrganizationProfileController,
    ShowcaseController,
    PublicShowcaseController,
  ],
  providers: [
    ParticipantProfilesService,
    OrganizationProfileService,
    ShowcaseService,
    PublicShowcaseService,
    ParticipantProfilesRepository,
    OrganizationProfileRepository,
    ShowcaseRepository,
  ],
  exports: [ParticipantProfilesService],
})
export class ProfilesModule {}
