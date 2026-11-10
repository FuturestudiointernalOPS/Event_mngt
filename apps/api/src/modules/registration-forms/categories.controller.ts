import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  CAPABILITY_KEYS,
  createCategoryRequestSchema,
  updateCategoryRequestSchema,
  type Category,
  type CreateCategoryRequest,
  type UpdateCategoryRequest,
} from '@event-platform/shared';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CategoriesService } from './categories.service';

/** Participant categories for one event. */
@Controller('workspaces/:slug/events/:eventId/categories')
@TenantScoped('slug')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @RequireCapability(CAPABILITY_KEYS.registrationsViewCategories)
  list(@Param('eventId', new ParseUUIDPipe()) eventId: string): Promise<Category[]> {
    return this.categories.list(eventId);
  }

  @Post()
  @RequireCapability(CAPABILITY_KEYS.registrationsManageCategories)
  create(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body(new ZodValidationPipe(createCategoryRequestSchema))
    body: CreateCategoryRequest,
  ): Promise<Category> {
    return this.categories.create(eventId, body);
  }

  @Patch(':categoryId')
  @RequireCapability(CAPABILITY_KEYS.registrationsManageCategories)
  update(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
    @Body(new ZodValidationPipe(updateCategoryRequestSchema))
    body: UpdateCategoryRequest,
  ): Promise<Category> {
    return this.categories.update(eventId, categoryId, body);
  }
}
