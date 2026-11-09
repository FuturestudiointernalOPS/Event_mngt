import { Module } from '@nestjs/common';
import { PublicRegistrationFormService } from './public-registration-form.service';
import { PublicRegistrationsController } from './public-registrations.controller';
import { PublicRegistrationsService } from './public-registrations.service';
import { RegistrationSetupController } from './registration-setup.controller';
import { RegistrationSetupService } from './registration-setup.service';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsRepository } from './registrations.repository';
import { RegistrationsService } from './registrations.service';

@Module({
  controllers: [RegistrationSetupController, RegistrationsController, PublicRegistrationsController],
  providers: [
    RegistrationSetupService,
    RegistrationsService,
    RegistrationsRepository,
    PublicRegistrationsService,
    PublicRegistrationFormService,
  ],
  exports: [RegistrationsService],
})
export class RegistrationsModule {}
