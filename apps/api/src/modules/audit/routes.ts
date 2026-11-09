import { PERMISSIONS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { AuditController } from './audit.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/workspaces/:slug/audit',
    permission: PERMISSIONS.auditRead,
    handler: { controller: AuditController, method: 'list' },
  },
];
