import {
  API_PATHS,
  type AuthenticatedSession,
  type CurrentUserResponse,
  type LoginRequest,
  type RegisterRequest,
  type SessionSummary,
} from '@event-platform/shared';
import { useSessionStore } from '../stores/session.store';
import { apiRequest, refreshSession } from './api-client';

export const authApi = {
  async login(payload: LoginRequest): Promise<AuthenticatedSession> {
    const session = await apiRequest<AuthenticatedSession>(API_PATHS.auth.login, {
      method: 'POST',
      body: payload,
    });
    useSessionStore.getState().setSession(session);
    return session;
  },

  register(payload: RegisterRequest): Promise<{ accepted: true }> {
    return apiRequest<{ accepted: true }>(API_PATHS.auth.register, {
      method: 'POST',
      body: payload,
    });
  },

  async logout(): Promise<void> {
    try {
      await apiRequest<void>(API_PATHS.auth.logout, { method: 'POST' });
    } finally {
      useSessionStore.getState().clear();
    }
  },

  me(): Promise<CurrentUserResponse> {
    return apiRequest<CurrentUserResponse>(API_PATHS.auth.me);
  },

  sessions(): Promise<SessionSummary[]> {
    return apiRequest<SessionSummary[]>(API_PATHS.auth.sessions);
  },
};

/**
 * Called once on application start: the access token is memory-only, so a page
 * reload relies on the HttpOnly refresh cookie to restore the session silently.
 */
export async function bootstrapSession(): Promise<void> {
  try {
    const refreshed = await refreshSession();

    if (!refreshed) {
      return;
    }

    try {
      const current = await authApi.me();
      useSessionStore.getState().setUser(current.user, current.memberships);
    } catch {
      useSessionStore.getState().clear();
    }
  } finally {
    useSessionStore.getState().markReady();
  }
}
