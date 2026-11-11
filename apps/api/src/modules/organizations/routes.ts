import { CAPABILITY_KEYS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { OrganizationsController } from './organizations.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'POST',
    path: '/onboarding/organizations',
    capability: CAPABILITY_KEYS.organizationCreate,
    handler: { controller: OrganizationsController, method: 'create' },
  },
];
