import { CAPABILITY_KEYS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { ExportsController } from './exports.controller';
import { ReportsController } from './reports.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/reports/summary',
    capability: CAPABILITY_KEYS.reportsView,
    handler: { controller: ReportsController, method: 'eventSummary' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/reports/summary',
    capability: CAPABILITY_KEYS.reportsView,
    handler: { controller: ReportsController, method: 'organizationSummary' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/reports/editions',
    capability: CAPABILITY_KEYS.reportsView,
    handler: { controller: ReportsController, method: 'editions' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/exports',
    capability: CAPABILITY_KEYS.reportsExport,
    handler: { controller: ExportsController, method: 'create' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/exports',
    capability: CAPABILITY_KEYS.reportsView,
    handler: { controller: ExportsController, method: 'list' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/exports/:exportId',
    capability: CAPABILITY_KEYS.reportsView,
    handler: { controller: ExportsController, method: 'detail' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/exports/:exportId/download',
    capability: CAPABILITY_KEYS.reportsExport,
    handler: { controller: ExportsController, method: 'download' },
  },
];
