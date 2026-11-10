import { Module } from '@nestjs/common';
import { BadgesModule } from '../badges/badges.module';
import { ConsentModule } from '../consent/consent.module';
import { EventsModule } from '../events/events.module';
import { ModuleRegistryModule } from '../module-registry/module-registry.module';
import { RegistrationFormsModule } from '../registration-forms/registration-forms.module';
import { PublicRegistrationsController } from './public-registrations.controller';
import { RegistrationSubmissionService } from './registration-submission.service';
import { RegistrationsController } from './registrations.controller';
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
  controllers: [RegistrationsController, PublicRegistrationsController],
  providers: [
    RegistrationsService,
    RegistrationSubmissionService,
    RegistrationsRepository,
  ],
})
export class RegistrationsModule {}
