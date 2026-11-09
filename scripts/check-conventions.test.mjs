/**
 * Tests for the conventions gate itself (rule R11).
 *
 * Each check is exercised twice: a fixture that must be rejected, and the real
 * repository, which must pass. A gate that cannot fail is not a gate.
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { MAX_LINES, runConventions } from './check-conventions.mjs';

const created = [];

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'conventions-'));
  created.push(root);

  for (const [relPath, content] of Object.entries(files)) {
    const full = join(root, relPath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }

  return root;
}

function lines(count) {
  return `${Array.from({ length: count }, (_, index) => `export const v${index} = ${index};`).join('\n')}\n`;
}

const SERVICE = 'apps/api/src/modules/events/events.service.ts';

after(() => {
  for (const root of created) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('conventions gate', () => {
  it('accepts the real repository', () => {
    const { errors } = runConventions(process.cwd());
    assert.deepEqual(errors, []);
  });

  it('accepts a compliant fixture', () => {
    const root = fixture({
      [SERVICE]: "import { AppException } from '../../common/app-exception';\n",
      'apps/api/src/modules/events/events.repository.ts':
        "import { PrismaService } from '../../database/prisma.service';\n",
      'apps/api/src/database/prisma-client.ts': "export * from '../generated/prisma/client';\n",
      'apps/api/src/config/env.validation.ts': "export const url = process.env.DATABASE_URL;\n",
    });

    assert.deepEqual(runConventions(root).errors, []);
  });

  it(`rejects a file over ${MAX_LINES} lines`, () => {
    const root = fixture({ [SERVICE]: lines(MAX_LINES + 1) });
    const { errors } = runConventions(root);

    assert.equal(errors.length, 1);
    assert.match(errors[0], /over the 300-line limit/);
  });

  it('warns, but does not fail, near the limit', () => {
    const root = fixture({ [SERVICE]: lines(Math.ceil(MAX_LINES * 0.95)) });
    const { errors, warnings } = runConventions(root);

    assert.deepEqual(errors, []);
    assert.equal(warnings.length, 1);
  });

  it('rejects a controller that reaches the data layer', () => {
    const root = fixture({
      'apps/api/src/modules/events/events.controller.ts':
        "import { PrismaService } from '../../database/prisma.service';\n",
    });
    const { errors } = runConventions(root);

    assert.equal(errors.length, 1);
    assert.match(errors[0], /reaches the data layer directly/);
  });

  it('rejects a direct import of the generated client', () => {
    const root = fixture({
      'apps/api/src/modules/events/events.repository.ts':
        "import { Prisma } from '@prisma/client';\n",
    });
    const { errors } = runConventions(root);

    assert.equal(errors.length, 1);
    assert.match(errors[0], /generated client/);
  });

  it('rejects environment reads in feature code', () => {
    const root = fixture({ [SERVICE]: 'export const secret = process.env.JWT_ACCESS_SECRET;\n' });
    const { errors } = runConventions(root);

    assert.equal(errors.length, 1);
    assert.match(errors[0], /reads the environment directly/);
  });

  it('rejects importing another module repository', () => {
    const root = fixture({
      [SERVICE]: "import { toBranding } from '../workspaces/workspaces.repository';\n",
    });
    const { errors } = runConventions(root);

    assert.equal(errors.length, 1);
    assert.match(errors[0], /module "workspaces"/);
  });

  it('allows a module to import its own repository', () => {
    const root = fixture({
      [SERVICE]: "import { EventsRepository } from './events.repository';\n",
    });

    assert.deepEqual(runConventions(root).errors, []);
  });
});
