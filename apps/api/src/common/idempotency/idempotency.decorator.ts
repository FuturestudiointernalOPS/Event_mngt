import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'idempotent';

/**
 * Opts a state-changing route into Idempotency-Key handling (WP-08).
 *
 * Without the header the route behaves exactly as before. With it, the first request
 * runs normally and its response is stored; a replay with the same key and payload
 * returns the stored response and does not run the handler again.
 */
export const Idempotent = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IDEMPOTENT_KEY, true);
