import 'reflect-metadata';
import { RequestMethod, type Type } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { REQUIRED_CAPABILITIES_KEY } from '../decorators/require-capability.decorator';
import { TENANT_SCOPE_KEY } from '../decorators/tenant-scoped.decorator';
import type { HttpMethod } from './route-definition';

const HTTP_METHODS: Partial<Record<RequestMethod, HttpMethod>> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.DELETE]: 'DELETE',
};

export interface ControllerRoute {
  controller: Type<unknown>;
  /** The controller method name. */
  method: string;
  httpMethod: HttpMethod;
  /** The full path below `/api/v1`, including the controller prefix. */
  path: string;
  capabilities: string[];
  public: boolean;
  tenantScoped: boolean;
}

/**
 * Reads the route metadata Nest stores on a controller.
 *
 * This is the source the catalogue is checked against: `@Get()`/`@Post()` store the
 * path and verb on the handler function, while the project's decorators store the
 * permission and tenant scope there too. No Nest module is constructed, so the test
 * does not need a database or configuration.
 */
export function describeController(controller: Type<unknown>): ControllerRoute[] {
  const prefix = Reflect.getMetadata(PATH_METADATA, controller) as string | undefined;
  const classPublic = Reflect.getMetadata(IS_PUBLIC_KEY, controller) === true;
  const classScope = Reflect.getMetadata(TENANT_SCOPE_KEY, controller) as string | undefined;
  const prototype = controller.prototype as Record<string, unknown>;

  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor' && typeof prototype[name] === 'function')
    .flatMap((name) => {
      const handler = prototype[name] as (...args: unknown[]) => unknown;
      const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler) as
        | RequestMethod
        | undefined;

      if (requestMethod === undefined) {
        return [];
      }

      const httpMethod = HTTP_METHODS[requestMethod];

      if (!httpMethod) {
        return [];
      }

      const rawPath = Reflect.getMetadata(PATH_METADATA, handler) as
        | string
        | string[]
        | undefined;
      const paths = Array.isArray(rawPath) ? rawPath : [rawPath ?? ''];
      const capabilities =
        (Reflect.getMetadata(REQUIRED_CAPABILITIES_KEY, handler) as string[] | undefined) ?? [];
      const methodScope = Reflect.getMetadata(TENANT_SCOPE_KEY, handler) as
        | string
        | undefined;

      return paths.map((path) => ({
        controller,
        method: name,
        httpMethod,
        path: joinRoutePath(prefix, path),
        capabilities,
        public: classPublic || Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true,
        tenantScoped: Boolean(methodScope ?? classScope),
      }));
    });
}

/** Joins a controller prefix and a handler path into one `/`-prefixed route path. */
export function joinRoutePath(prefix: string | undefined, path: string | undefined): string {
  const segments = [prefix ?? '', path ?? '']
    .map((segment) => segment.replace(/^\/+|\/+$/g, ''))
    .filter((segment) => segment.length > 0);

  return `/${segments.join('/')}`;
}
