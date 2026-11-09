import { createHmac } from 'node:crypto';

/** The badge signing key: explicit when configured, otherwise derived from the JWT secret. */
export function resolveBadgeSecret(explicit: string | undefined, jwtSecret: string): string {
  return explicit ?? createHmac('sha256', jwtSecret).update('event-platform/badge-signing').digest('hex');
}
