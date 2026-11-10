import type { RouteDefinition } from '../../common/routes/route-definition';
import { AuthController } from './auth.controller';

/**
 * Every route the auth surface exposes. Public routes carry no capability; the
 * catalogue records that explicitly with `null` rather than omitting the field.
 */
export const routes: RouteDefinition[] = [
  {
    method: 'POST',
    path: '/auth/register',
    capability: null,
    handler: { controller: AuthController, method: 'register' },
  },
  {
    method: 'POST',
    path: '/auth/verify-email',
    capability: null,
    handler: { controller: AuthController, method: 'verifyEmail' },
  },
  {
    method: 'POST',
    path: '/auth/login',
    capability: null,
    handler: { controller: AuthController, method: 'login' },
  },
  {
    method: 'POST',
    path: '/auth/refresh',
    capability: null,
    handler: { controller: AuthController, method: 'refresh' },
  },
  {
    method: 'POST',
    path: '/auth/logout',
    capability: null,
    handler: { controller: AuthController, method: 'logout' },
  },
  {
    method: 'POST',
    path: '/auth/forgot-password',
    capability: null,
    handler: { controller: AuthController, method: 'forgotPassword' },
  },
  {
    method: 'POST',
    path: '/auth/reset-password',
    capability: null,
    handler: { controller: AuthController, method: 'resetPassword' },
  },
  {
    method: 'GET',
    path: '/auth/me',
    capability: null,
    handler: { controller: AuthController, method: 'me' },
  },
  {
    method: 'GET',
    path: '/auth/sessions',
    capability: null,
    handler: { controller: AuthController, method: 'sessions' },
  },
  {
    method: 'DELETE',
    path: '/auth/sessions/:sessionId',
    capability: null,
    handler: { controller: AuthController, method: 'revokeSession' },
  },
];
