import { CAPABILITY_KEYS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { AuditController } from './audit.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/workspaces/:slug/audit',
    capability: CAPABILITY_KEYS.organizationViewAuditLog,
    handler: { controller: AuditController, method: 'list' },
  },
];
