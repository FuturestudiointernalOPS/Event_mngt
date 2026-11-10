import { PERMISSIONS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { CategoriesController } from './categories.controller';
import { PublicRegistrationFormController } from './public-registration-form.controller';
import { RegistrationFormController } from './registration-form.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/categories',
    permission: PERMISSIONS.registrationRead,
    handler: { controller: CategoriesController, method: 'list' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/categories',
    permission: PERMISSIONS.registrationManage,
    handler: { controller: CategoriesController, method: 'create' },
  },
  {
    method: 'PATCH',
    path: '/workspaces/:slug/events/:eventId/categories/:categoryId',
    permission: PERMISSIONS.registrationManage,
    handler: { controller: CategoriesController, method: 'update' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/registration-form',
    permission: PERMISSIONS.registrationRead,
    handler: { controller: RegistrationFormController, method: 'show' },
  },
  {
    method: 'PUT',
    path: '/workspaces/:slug/events/:eventId/registration-form',
    permission: PERMISSIONS.registrationManage,
    handler: { controller: RegistrationFormController, method: 'save' },
  },
  {
    method: 'GET',
    path: '/public/events/:eventSlug/registration-form',
    permission: null,
    handler: { controller: PublicRegistrationFormController, method: 'show' },
  },
];
