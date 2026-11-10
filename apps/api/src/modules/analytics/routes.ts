import type { RouteDefinition } from '../../common/routes/route-definition';
import { PublicMetricsController } from './public-metrics.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/public/events/:eventSlug/metrics',
    capability: null,
    handler: { controller: PublicMetricsController, method: 'get' },
  },
];
