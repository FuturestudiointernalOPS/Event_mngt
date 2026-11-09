import { ApiRequestError } from '@/services/api-client';

/** The message to show for a failed request: the API's own, or a generic fallback. */
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError ? error.message : fallback;
}
