import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_PERMISSIONS } from '@event-platform/shared';
import { describe, expect, it } from 'vitest';

/**
 * Guards against drift between the shared permission catalogue and the database: roles are
 * built from permission rows, so a permission that exists only in code could never be
 * granted. Every key must be inserted by some migration.
 */
describe('permission catalogue', () => {
  const migrations = join(__dirname, '..', '..', 'prisma', 'migrations');
  const sql = readdirSync(migrations, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readFileSync(join(migrations, entry.name, 'migration.sql'), 'utf8'))
    .join('\n');

  it('is seeded by the migrations, key for key', () => {
    const missing = ALL_PERMISSIONS.filter((key) => !sql.includes(`'${key}'`));

    expect(missing).toEqual([]);
  });

  it('does not seed a permission the code no longer defines', () => {
    const seeded = [...sql.matchAll(/gen_random_uuid\(\), '([a-z]+:[a-z]+)'/g)].map((m) => m[1]);
    const stale = seeded.filter((key) => !ALL_PERMISSIONS.includes(key as never));

    expect(stale).toEqual([]);
  });
});
