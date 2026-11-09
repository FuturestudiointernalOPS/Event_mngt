import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  CategoryInput,
  CategoryView,
  ConsentSettings,
  FieldInput,
  FieldView,
  PERMISSIONS,
  UpdateCategoryInput,
  UpdateFieldInput,
  categoryInputSchema,
  consentSettingsSchema,
  fieldInputSchema,
  updateCategorySchema,
  updateFieldSchema,
} from '@event-platform/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { RegistrationSetupService } from './registration-setup.service';

const uuid = () => new ParseUUIDPipe();

/** Staff configuration of an event's registration: categories, form fields and consent. */
@Controller('workspaces/:slug/events/:eventId')
@TenantScoped('slug')
export class RegistrationSetupController {
  constructor(private readonly setup: RegistrationSetupService) {}

  @Get('categories')
  @RequirePermissions(PERMISSIONS.registrationRead)
  categories(@Param('eventId', uuid()) eventId: string): Promise<CategoryView[]> {
    return this.setup.listCategories(eventId);
  }

  @Post('categories')
  @RequirePermissions(PERMISSIONS.registrationManage)
  createCategory(
    @Param('eventId', uuid()) eventId: string,
    @Body(new ZodValidationPipe(categoryInputSchema)) body: CategoryInput,
  ): Promise<CategoryView[]> {
    return this.setup.createCategory(eventId, body);
  }

  @Patch('categories/:categoryId')
  @RequirePermissions(PERMISSIONS.registrationManage)
  updateCategory(
    @Param('eventId', uuid()) eventId: string,
    @Param('categoryId', uuid()) categoryId: string,
    @Body(new ZodValidationPipe(updateCategorySchema)) body: UpdateCategoryInput,
  ): Promise<CategoryView[]> {
    return this.setup.updateCategory(eventId, categoryId, body);
  }

  @Delete('categories/:categoryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.registrationManage)
  deleteCategory(
    @Param('eventId', uuid()) eventId: string,
    @Param('categoryId', uuid()) categoryId: string,
  ): Promise<void> {
    return this.setup.deleteCategory(eventId, categoryId);
  }

  @Get('form-fields')
  @RequirePermissions(PERMISSIONS.registrationRead)
  fields(@Param('eventId', uuid()) eventId: string): Promise<FieldView[]> {
    return this.setup.listFields(eventId);
  }

  @Post('form-fields')
  @RequirePermissions(PERMISSIONS.registrationManage)
  createField(
    @Param('eventId', uuid()) eventId: string,
    @Body(new ZodValidationPipe(fieldInputSchema)) body: FieldInput,
  ): Promise<FieldView[]> {
    return this.setup.createField(eventId, body);
  }

  @Patch('form-fields/:fieldId')
  @RequirePermissions(PERMISSIONS.registrationManage)
  updateField(
    @Param('eventId', uuid()) eventId: string,
    @Param('fieldId', uuid()) fieldId: string,
    @Body(new ZodValidationPipe(updateFieldSchema)) body: UpdateFieldInput,
  ): Promise<FieldView[]> {
    return this.setup.updateField(eventId, fieldId, body);
  }

  @Delete('form-fields/:fieldId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.registrationManage)
  deleteField(
    @Param('eventId', uuid()) eventId: string,
    @Param('fieldId', uuid()) fieldId: string,
  ): Promise<void> {
    return this.setup.deleteField(eventId, fieldId);
  }

  @Get('consent')
  @RequirePermissions(PERMISSIONS.registrationRead)
  consent(@Param('eventId', uuid()) eventId: string) {
    return this.setup.getConsent(eventId);
  }

  @Put('consent')
  @RequirePermissions(PERMISSIONS.registrationManage)
  setConsent(
    @Param('eventId', uuid()) eventId: string,
    @Body(new ZodValidationPipe(consentSettingsSchema)) body: ConsentSettings,
  ) {
    return this.setup.setConsent(eventId, body);
  }
}
