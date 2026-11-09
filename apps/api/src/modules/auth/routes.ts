import type { RouteDefinition } from '../../common/routes/route-definition';
import { AuthController } from './auth.controller';

/**
 * Every route the auth surface exposes. Public routes carry no permission; the
 * catalogue records that explicitly with `null` rather than omitting the field.
 */
export const routes: RouteDefinition[] = [
  {
    method: 'POST',
    path: '/auth/register',
    permission: null,
    handler: { controller: AuthController, method: 'register' },
  },
  {
    method: 'POST',
    path: '/auth/verify-email',
    permission: null,
    handler: { controller: AuthController, method: 'verifyEmail' },
  },
  {
    method: 'POST',
    path: '/auth/login',
    permission: null,
    handler: { controller: AuthController, method: 'login' },
  },
  {
    method: 'POST',
    path: '/auth/refresh',
    permission: null,
    handler: { controller: AuthController, method: 'refresh' },
  },
  {
    method: 'POST',
    path: '/auth/logout',
    permission: null,
    handler: { controller: AuthController, method: 'logout' },
  },
  {
    method: 'POST',
    path: '/auth/forgot-password',
    permission: null,
    handler: { controller: AuthController, method: 'forgotPassword' },
  },
  {
    method: 'POST',
    path: '/auth/reset-password',
    permission: null,
    handler: { controller: AuthController, method: 'resetPassword' },
  },
  {
    method: 'GET',
    path: '/auth/me',
    permission: null,
    handler: { controller: AuthController, method: 'me' },
  },
  {
    method: 'GET',
    path: '/auth/sessions',
    permission: null,
    handler: { controller: AuthController, method: 'sessions' },
  },
  {
    method: 'DELETE',
    path: '/auth/sessions/:sessionId',
    permission: null,
    handler: { controller: AuthController, method: 'revokeSession' },
  },
];
