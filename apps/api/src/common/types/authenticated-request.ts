import type { Request } from 'express';
import type { TenantAccess, AuthenticatedUser, ParticipantAccess } from './authenticated-user';

/**
 * Express request enriched by the global pipeline.
 * Guards populate `user` and `tenant`; the request-id middleware populates `requestId`.
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  tenant?: TenantAccess;
  participant?: ParticipantAccess;
  requestId?: string;
}
