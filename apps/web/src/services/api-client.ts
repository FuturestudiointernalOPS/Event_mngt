import {
  API_PATHS,
  CSRF_COOKIE,
  CSRF_TOKEN_HEADER,
  type ApiEnvelope,
  type ApiError as ApiErrorBody,
  type RefreshResponse,
} from '@event-platform/shared';
import { readCookie } from '../lib/cookies';
import { env } from '../lib/env';
import { useSessionStore } from '../stores/session.store';

/** Normalised failure thrown by the client. Services and pages catch this type. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Silent session recovery. Concurrent 401s share one refresh request, so a burst of
 * failing queries does not rotate the refresh token several times.
 */
export function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function performRefresh(): Promise<boolean> {
  const csrfToken = readCookie(CSRF_COOKIE);

  if (!csrfToken) {
    return false;
  }

  try {
    const response = await fetch(`${env.apiUrl}${API_PATHS.auth.refresh}`, {
      method: 'POST',
      credentials: 'include',
      headers: { [CSRF_TOKEN_HEADER]: csrfToken },
    });

    if (!response.ok) {
      useSessionStore.getState().clear();
      return false;
    }

    const payload = (await response.json()) as ApiEnvelope<RefreshResponse>;
    useSessionStore.getState().setAccessToken(payload.data.accessToken);
    return true;
  } catch {
    useSessionStore.getState().clear();
    return false;
  }
}

/**
 * The only way the UI talks to the API. Unwraps the `{ data, meta }` envelope and
 * retries once after a successful refresh.
 */
export function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  return sendEnvelope<T>(path, options, true).then((envelope) => envelope.data);
}

/**
 * Paginated endpoints need `meta.pagination`, so the envelope is returned intact.
 */
export function apiRequestWithMeta<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiEnvelope<T>> {
  return sendEnvelope<T>(path, options, true);
}

async function sendEnvelope<T>(
  path: string,
  options: ApiRequestOptions,
  allowRetry: boolean,
): Promise<ApiEnvelope<T>> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const accessToken = useSessionStore.getState().accessToken;
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${env.apiUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  if (response.status === 401 && allowRetry && !path.includes('/auth/refresh')) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return sendEnvelope<T>(path, options, false);
    }
  }

  if (response.status === 204) {
    return { data: undefined as T, meta: { requestId: '', timestamp: '' } };
  }

  const text = await response.text();
  let payload: unknown = null;

  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const body = payload as ApiErrorBody | null;
    throw new ApiRequestError(
      response.status,
      body?.error.code ?? 'request_failed',
      body?.error.message ?? 'The request could not be completed.',
      body?.error.details,
    );
  }

  return payload as ApiEnvelope<T>;
}
