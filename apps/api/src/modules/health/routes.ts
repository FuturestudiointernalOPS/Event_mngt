import type { RouteDefinition } from '../../common/routes/route-definition';
import { HealthController } from './health.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/health',
    capability: null,
    handler: { controller: HealthController, method: 'check' },
  },
  {
    method: 'GET',
    path: '/health/ready',
    capability: null,
    handler: { controller: HealthController, method: 'ready' },
  },
];
