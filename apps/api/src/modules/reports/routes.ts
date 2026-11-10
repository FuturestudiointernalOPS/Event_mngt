import { PERMISSIONS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { ExportsController } from './exports.controller';
import { ReportsController } from './reports.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/reports/summary',
    permission: PERMISSIONS.reportRead,
    handler: { controller: ReportsController, method: 'eventSummary' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/reports/summary',
    permission: PERMISSIONS.reportRead,
    handler: { controller: ReportsController, method: 'organizationSummary' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/reports/editions',
    permission: PERMISSIONS.reportRead,
    handler: { controller: ReportsController, method: 'editions' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/exports',
    permission: PERMISSIONS.reportExport,
    handler: { controller: ExportsController, method: 'create' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/exports',
    permission: PERMISSIONS.reportRead,
    handler: { controller: ExportsController, method: 'list' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/exports/:exportId',
    permission: PERMISSIONS.reportRead,
    handler: { controller: ExportsController, method: 'detail' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/exports/:exportId/download',
    permission: PERMISSIONS.reportExport,
    handler: { controller: ExportsController, method: 'download' },
  },
];
