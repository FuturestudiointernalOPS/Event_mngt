import type { RouteDefinition } from '../../common/routes/route-definition';
import { ParticipantPortalController } from './participant-portal.controller';

/** Authenticated by the participant credential, not by a staff capability. */
export const routes: RouteDefinition[] = [
  { method: 'GET', path: '/participant/me', capability: null, handler: { controller: ParticipantPortalController, method: 'me' } },
  { method: 'GET', path: '/participant/export', capability: null, handler: { controller: ParticipantPortalController, method: 'exportData' } },
  { method: 'POST', path: '/participant/withdraw', capability: null, handler: { controller: ParticipantPortalController, method: 'withdraw' } },
  { method: 'POST', path: '/participant/erase', capability: null, handler: { controller: ParticipantPortalController, method: 'erase' } },
  { method: 'GET', path: '/participant/profile', capability: null, handler: { controller: ParticipantPortalController, method: 'profile' } },
  { method: 'PUT', path: '/participant/profile', capability: null, handler: { controller: ParticipantPortalController, method: 'saveProfile' } },
  { method: 'GET', path: '/participant/directory', capability: null, handler: { controller: ParticipantPortalController, method: 'directory' } },
  { method: 'GET', path: '/participant/meetings', capability: null, handler: { controller: ParticipantPortalController, method: 'meetings' } },
  { method: 'POST', path: '/participant/meetings', capability: null, handler: { controller: ParticipantPortalController, method: 'proposeMeeting' } },
  { method: 'POST', path: '/participant/meetings/:meetingId/respond', capability: null, handler: { controller: ParticipantPortalController, method: 'respondToMeeting' } },
  { method: 'GET', path: '/participant/introductions', capability: null, handler: { controller: ParticipantPortalController, method: 'introductions' } },
  { method: 'POST', path: '/participant/introductions', capability: null, handler: { controller: ParticipantPortalController, method: 'requestIntroduction' } },
];
