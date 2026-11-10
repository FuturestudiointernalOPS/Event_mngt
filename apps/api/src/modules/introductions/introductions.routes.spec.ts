import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { routes } from './routes';

/**
 * Acceptance 14: the status history is append-only. It is returned with the detail and
 * no route can update or delete a history row.
 */
describe('introduction route surface', () => {
  it('catalogues exactly the queue routes', () => {
    expect(routes.map((route) => `${route.method} ${route.path}`)).toEqual([
      'GET /workspaces/:slug/events/:eventId/introductions',
      'POST /workspaces/:slug/events/:eventId/introductions',
      'GET /workspaces/:slug/events/:eventId/introductions/:introductionId',
      'PATCH /workspaces/:slug/events/:eventId/introductions/:introductionId',
    ]);
  });

  it('exposes no route that updates or deletes a status-history row', () => {
    expect(
      routes.filter(
        (route) => route.method === 'PUT' || route.method === 'DELETE',
      ),
    ).toEqual([]);
    expect(routes.some((route) => route.path.includes('history'))).toBe(false);
  });
});
