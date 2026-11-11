import { CAPABILITY_KEYS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { CategoriesController } from './categories.controller';
import { PublicRegistrationFormController } from './public-registration-form.controller';
import { RegistrationFormController } from './registration-form.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/categories',
    capability: CAPABILITY_KEYS.registrationsViewCategories,
    handler: { controller: CategoriesController, method: 'list' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/categories',
    capability: CAPABILITY_KEYS.registrationsManageCategories,
    handler: { controller: CategoriesController, method: 'create' },
  },
  {
    method: 'PATCH',
    path: '/workspaces/:slug/events/:eventId/categories/:categoryId',
    capability: CAPABILITY_KEYS.registrationsManageCategories,
    handler: { controller: CategoriesController, method: 'update' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/registration-form',
    capability: CAPABILITY_KEYS.registrationsViewForm,
    handler: { controller: RegistrationFormController, method: 'show' },
  },
  {
    method: 'PUT',
    path: '/workspaces/:slug/events/:eventId/registration-form',
    capability: CAPABILITY_KEYS.registrationsManageForm,
    handler: { controller: RegistrationFormController, method: 'save' },
  },
  {
    method: 'GET',
    path: '/public/events/:eventSlug/registration-form',
    capability: null,
    handler: { controller: PublicRegistrationFormController, method: 'show' },
  },
];
