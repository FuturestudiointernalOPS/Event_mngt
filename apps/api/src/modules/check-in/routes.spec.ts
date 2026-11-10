import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '@event-platform/shared';
import { describeController } from '../../common/routes/route-metadata';
import { CheckInsController } from './check-ins.controller';
import { routes } from './routes';

const actual = describeController(CheckInsController);

describe('check-in route catalogue', () => {
  it('catalogues every decorated handler with the same verb, path and permission', () => {
    expect(actual).toHaveLength(routes.length);

    for (const route of routes) {
      const match = actual.find(
        (entry) =>
          entry.controller === route.handler.controller &&
          entry.method === route.handler.method &&
          entry.httpMethod === route.method &&
          entry.path === route.path,
      );

      expect(match).toBeDefined();
      expect(match?.permissions).toEqual(
        route.permission === null ? [] : [route.permission],
      );
      expect(match?.tenantScoped).toBe(true);
    }
  });

  it('requires checkin:operate to scan or sync and checkin:read to look', () => {
    const writes = actual.filter((entry) => entry.httpMethod === 'POST');
    const reads = actual.filter((entry) => entry.httpMethod === 'GET');

    expect(writes).toHaveLength(2);
    for (const write of writes) {
      expect(write.permissions).toEqual([PERMISSIONS.checkinOperate]);
    }

    expect(reads).toHaveLength(2);
    for (const read of reads) {
      expect(read.permissions).toEqual([PERMISSIONS.checkinRead]);
    }
  });
});
