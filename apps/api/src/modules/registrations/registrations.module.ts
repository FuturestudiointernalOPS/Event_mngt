import { Module } from '@nestjs/common';
import { BadgesModule } from '../badges/badges.module';
import { ConsentModule } from '../consent/consent.module';
import { EventsModule } from '../events/events.module';
import { ModuleRegistryModule } from '../module-registry/module-registry.module';
import { RegistrationFormsModule } from '../registration-forms/registration-forms.module';
import { PublicRegistrationsController } from './public-registrations.controller';
import { RegistrationSubmissionService } from './registration-submission.service';
import { RegistrationsRetentionController } from './registrations-retention.controller';
import { RegistrationsRetentionService } from './registrations-retention.service';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsErasureRepository } from './registrations-erasure.repository';
import { RegistrationsRepository } from './registrations.repository';
import { RegistrationsService } from './registrations.service';

@Module({
  imports: [
    EventsModule,
    RegistrationFormsModule,
    ConsentModule,
    ModuleRegistryModule,
    BadgesModule,
  ],
  controllers: [
    RegistrationsController,
    PublicRegistrationsController,
    RegistrationsRetentionController,
  ],
  providers: [
    RegistrationsService,
    RegistrationsRetentionService,
    RegistrationSubmissionService,
    RegistrationsRepository,
    RegistrationsErasureRepository,
  ],
  exports: [RegistrationsService],
})
export class RegistrationsModule {}
