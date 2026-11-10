import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { CAPABILITY_KEYS } from '@event-platform/shared';
import { describeController } from '../../common/routes/route-metadata';
import { CheckInsController } from './check-ins.controller';
import { routes } from './routes';

const actual = describeController(CheckInsController);

describe('check-in route catalogue', () => {
  it('catalogues every decorated handler with the same verb, path and capability', () => {
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
      expect(match?.capabilities).toEqual(
        route.capability === null ? [] : [route.capability],
      );
      expect(match?.tenantScoped).toBe(true);
    }
  });

  it('requires check_in.operate to scan or sync and check_in.view to look', () => {
    const writes = actual.filter((entry) => entry.httpMethod === 'POST');
    const reads = actual.filter((entry) => entry.httpMethod === 'GET');

    expect(writes).toHaveLength(2);
    for (const write of writes) {
      expect(write.capabilities).toEqual([CAPABILITY_KEYS.checkInOperate]);
    }

    expect(reads).toHaveLength(2);
    for (const read of reads) {
      expect(read.capabilities).toEqual([CAPABILITY_KEYS.checkInView]);
    }
  });
});
