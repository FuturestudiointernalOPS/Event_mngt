import type { Type } from '@nestjs/common';

/** HTTP methods used by the API. Add one here before using it in a controller. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * One entry in a module's route catalogue.
 *
 * The catalogue is documentation with teeth: `routes.spec.ts` compares it with the
 * decorator metadata on the controller, so a route cannot exist in only one place.
 * Paths are relative to the API base (`/api/v1`) and include the controller prefix.
 */
export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  /**
   * The capability the route requires. `null` means public or signed-in-only.
   * One capability per route today; widen this to an array before a route needs two.
   */
  capability: string | null;
  handler: {
    controller: Type<unknown>;
    /** The controller method name, not the route path. */
    method: string;
  };
}
