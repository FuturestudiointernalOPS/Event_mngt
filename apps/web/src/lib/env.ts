const rawApiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

/**
 * The API origin only. Endpoint paths come from `@event-platform/shared` so a route
 * rename cannot desynchronise the two sides.
 */
export const env = {
  apiUrl: rawApiUrl.replace(/\/+$/, ''),
} as const;
