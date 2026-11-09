import 'reflect-metadata';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Type } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { AuditModule } from '../../modules/audit/audit.module';
import { routes as auditRoutes } from '../../modules/audit/routes';
import { AuthModule } from '../../modules/auth/auth.module';
import { routes as authRoutes } from '../../modules/auth/routes';
import { EventsModule } from '../../modules/events/events.module';
import { routes as eventRoutes } from '../../modules/events/routes';
import { HealthModule } from '../../modules/health/health.module';
import { routes as healthRoutes } from '../../modules/health/routes';
import { MembershipsModule } from '../../modules/memberships/memberships.module';
import { routes as membershipRoutes } from '../../modules/memberships/routes';
import { ModuleRegistryModule } from '../../modules/module-registry/module-registry.module';
import { routes as moduleRegistryRoutes } from '../../modules/module-registry/routes';
import { WorkspacesModule } from '../../modules/workspaces/workspaces.module';
import { routes as workspaceRoutes } from '../../modules/workspaces/routes';
import { describeController, type ControllerRoute } from './route-metadata';
import type { RouteDefinition } from './route-definition';

/**
 * The route catalogue is only useful if it cannot drift.
 *
 * The left side of every comparison is the hand-written `routes.ts`; the right side is
 * the decorator metadata on the real controllers. Adding a route without cataloguing it,
 * deleting a controller without removing its entry, or changing a permission now fails
 * here instead of in production.
 */

const MODULES: Array<Type<unknown>> = [
  AuditModule,
  AuthModule,
  EventsModule,
  HealthModule,
  MembershipsModule,
  ModuleRegistryModule,
  WorkspacesModule,
];

const CATALOGUES: Record<string, RouteDefinition[]> = {
  audit: auditRoutes,
  auth: authRoutes,
  events: eventRoutes,
  health: healthRoutes,
  memberships: membershipRoutes,
  'module-registry': moduleRegistryRoutes,
  workspaces: workspaceRoutes,
};

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
    '| Module | Method | Path | Permission | Handler |',
    '| --- | --- | --- | --- | --- |',
  ];

  for (const [moduleName, routes] of Object.entries(CATALOGUES)) {
    for (const route of routes) {
      const permission =
        route.permission === null ? '—' : `\`${route.permission}\``;
      const handler = `\`${route.handler.controller.name}.${route.handler.method}\``;

      lines.push(
        `| ${moduleName} | ${route.method} | \`${route.path}\` | ${permission} | ${handler} |`,
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

  it('records the permission the decorator actually requires', () => {
    const mismatched = CATALOGUED.flatMap(({ route }) => {
      const actual = matchingActual(route);

      if (!actual) {
        return [];
      }

      const expected = route.permission === null ? [] : [route.permission];

      return JSON.stringify(expected) === JSON.stringify(actual.permissions)
        ? []
        : [
            `${route.method} ${route.path}: catalogue ${JSON.stringify(expected)}, controller ${JSON.stringify(actual.permissions)}`,
          ];
    });

    expect(mismatched).toEqual([]);
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
