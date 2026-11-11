import type { PurgeExpiredResult } from '@event-platform/shared';
import { apiRequest } from './api-client';

const ws = (slug: string): string => `/api/v1/workspaces/${slug}`;

export const retentionApi = {
  purge: (slug: string, dryRun: boolean) =>
    apiRequest<PurgeExpiredResult>(`${ws(slug)}/retention/purge`, {
      method: 'POST',
      body: { dryRun },
    }),
};
