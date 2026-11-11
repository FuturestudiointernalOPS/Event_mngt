import { Module } from '@nestjs/common';
import { ConsentModule } from '../consent/consent.module';
import { EventsModule } from '../events/events.module';
import { ModuleRegistryModule } from '../module-registry/module-registry.module';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { PublicRegistrationFormController } from './public-registration-form.controller';
import { PublicRegistrationFormService } from './public-registration-form.service';
import { RegistrationFormController } from './registration-form.controller';
import { RegistrationFormService } from './registration-form.service';
import { RegistrationFormsRepository } from './registration-forms.repository';

@Module({
  imports: [EventsModule, ConsentModule, ModuleRegistryModule],
  controllers: [
    CategoriesController,
    RegistrationFormController,
    PublicRegistrationFormController,
  ],
  providers: [
    CategoriesService,
    RegistrationFormService,
    PublicRegistrationFormService,
    RegistrationFormsRepository,
  ],
  exports: [CategoriesService, RegistrationFormService],
})
export class RegistrationFormsModule {}
