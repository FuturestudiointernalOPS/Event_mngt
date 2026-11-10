import 'reflect-metadata';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Type } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { isCapabilityKey } from '@event-platform/shared';
import { CATALOGUES, MODULES } from './route-catalogues';
import { describeController, type ControllerRoute } from './route-metadata';
import type { RouteDefinition } from './route-definition';
const CONTROLLERS: Type<unknown>[] = MODULES.flatMap(
  (moduleClass) =>
    (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, moduleClass) as
      | Type<unknown>[]
      | undefined) ?? [],
);

const ACTUAL: ControllerRoute[] = CONTROLLERS.flatMap(describeController);

const CATALOGUED = Object.entries(CATALOGUES).flatMap(([moduleName, routes]) =>
  routes.map((route) => ({ moduleName, route })),
);

function matchingActual(route: RouteDefinition): ControllerRoute | undefined {
  return ACTUAL.find(
    (actual) =>
      actual.controller === route.handler.controller &&
      actual.method === route.handler.method &&
      actual.httpMethod === route.method &&
      actual.path === route.path,
  );
}

/** The single source for the Markdown table in docs/15. */
function renderCatalogueTable(): string {
  const lines = [
    '| Module | Method | Path | Capability | Handler |',
    '| --- | --- | --- | --- | --- |',
  ];

  for (const [moduleName, routes] of Object.entries(CATALOGUES)) {
    for (const route of routes) {
      const capability =
        route.capability === null ? '—' : `\`${route.capability}\``;
      const handler = `\`${route.handler.controller.name}.${route.handler.method}\``;

      lines.push(
        `| ${moduleName} | ${route.method} | \`${route.path}\` | ${capability} | ${handler} |`,
      );
    }
  }

  return lines.join('\n');
}

describe('route catalogue', () => {
  it('catalogues every module that has a controller, and nothing else', () => {
    const modulesDir = resolve(process.cwd(), 'src/modules');
    const directories = readdirSync(modulesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    const problems: string[] = [];

    for (const directory of directories) {
      const files = readdirSync(resolve(modulesDir, directory));
      const hasController = files.some((file) => file.endsWith('.controller.ts'));
      const hasRoutes = files.includes('routes.ts');

      if (hasController && !hasRoutes) {
        problems.push(`${directory} has a controller but no routes.ts`);
      }
      if (hasRoutes && !(directory in CATALOGUES)) {
        problems.push(`${directory} has routes.ts but is not aggregated in this spec`);
      }
    }

    for (const name of Object.keys(CATALOGUES)) {
      if (!directories.includes(name)) {
        problems.push(`catalogue "${name}" has no module directory`);
      }
    }

    expect(problems).toEqual([]);
  });

  it('does not let a controller route go uncatalogued', () => {
    const missing = ACTUAL.filter((actual) => {
      const route = CATALOGUED.find(
        ({ route: entry }) =>
          entry.handler.controller === actual.controller &&
          entry.handler.method === actual.method &&
          entry.method === actual.httpMethod &&
          entry.path === actual.path,
      );

      return route === undefined;
    }).map((actual) => `${actual.controller.name}.${actual.method} ${actual.httpMethod} ${actual.path}`);

    expect(missing).toEqual([]);
  });

  it('does not let a catalogue entry outlive its controller', () => {
    const stale = CATALOGUED.filter(({ route }) => matchingActual(route) === undefined).map(
      ({ moduleName, route }) =>
        `${moduleName}: ${route.method} ${route.path} (${route.handler.controller.name}.${route.handler.method})`,
    );

    expect(stale).toEqual([]);
  });

  it('records the capability the decorator actually requires', () => {
    const mismatched = CATALOGUED.flatMap(({ route }) => {
      const actual = matchingActual(route);

      if (!actual) {
        return [];
      }

      const expected = route.capability === null ? [] : [route.capability];

      return JSON.stringify(expected) === JSON.stringify(actual.capabilities)
        ? []
        : [
            `${route.method} ${route.path}: catalogue ${JSON.stringify(expected)}, controller ${JSON.stringify(actual.capabilities)}`,
          ];
    });

    expect(mismatched).toEqual([]);
  });

  it('names capabilities that exist in the registry', () => {
    const unknown = CATALOGUED.flatMap(({ route }) =>
      route.capability !== null && !isCapabilityKey(route.capability)
        ? [`${route.method} ${route.path}: ${route.capability}`]
        : [],
    );

    expect(unknown).toEqual([]);
  });

  it('requires a capability on every protected tenant route', () => {
    // A member may read their own effective capabilities without holding one, and the
    // module catalogue is a global, read-only description available to any session.
    const allowedWithoutCapability = new Set([
      'CapabilitiesController.self',
      'ModuleRegistryController.catalogue',
    ]);

    const unprotected = ACTUAL.filter(
      (actual) =>
        actual.tenantScoped &&
        !actual.public &&
        actual.capabilities.length === 0 &&
        !allowedWithoutCapability.has(`${actual.controller.name}.${actual.method}`),
    ).map(
      (actual) =>
        `${actual.controller.name}.${actual.method} ${actual.httpMethod} ${actual.path}`,
    );

    expect(unprotected).toEqual([]);
  });

  it('does not register the same verb and path twice', () => {
    const keys = CATALOGUED.map(({ route }) => `${route.method} ${route.path}`);
    const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);

    expect(duplicates).toEqual([]);
  });

  it('names only methods that exist on the controller', () => {
    const invalid = CATALOGUED.filter(
      ({ route }) =>
        typeof (route.handler.controller.prototype as Record<string, unknown>)[
          route.handler.method
        ] !== 'function',
    ).map(
      ({ moduleName, route }) =>
        `${moduleName}: ${route.handler.controller.name}.${route.handler.method}`,
    );

    expect(invalid).toEqual([]);
  });

  it('covers every controller registered in a feature module', () => {
    const uncatalogued = CONTROLLERS.filter(
      (controller) => !CATALOGUED.some(({ route }) => route.handler.controller === controller),
    ).map((controller) => controller.name);

    expect(uncatalogued).toEqual([]);
  });

  it('keeps the documentation table in step with the catalogues', () => {
    const document = readFileSync(
      resolve(process.cwd(), '../../docs/15-route-catalogue.md'),
      'utf8',
    );
    const section = /<!-- routes:start -->([\s\S]*?)<!-- routes:end -->/.exec(document);

    expect(section).not.toBeNull();
    expect(section?.[1].trim()).toBe(renderCatalogueTable());
  });
});
