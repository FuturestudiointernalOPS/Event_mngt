import type {
  AuthUser,
  AuthenticatedSession,
  MembershipSummary,
} from '@event-platform/shared';
import { create } from 'zustand';

type SessionStatus = 'anonymous' | 'authenticated';

interface SessionState {
  accessToken: string | null;
  user: AuthUser | null;
  memberships: MembershipSummary[];
  status: SessionStatus;
  /** False until the initial silent refresh has finished; guards wait for it. */
  sessionReady: boolean;
  setSession: (session: AuthenticatedSession) => void;
  setAccessToken: (accessToken: string) => void;
  setUser: (user: AuthUser, memberships: MembershipSummary[]) => void;
  markReady: () => void;
  clear: () => void;
}

/**
 * Client state that the server does not own: the in-memory access token and the
 * signed-in user summary. The refresh token lives in an HttpOnly cookie and is
 * never readable here.
 */
export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  user: null,
  memberships: [],
  status: 'anonymous',
  sessionReady: false,

  setSession: (session) =>
    set({
      accessToken: session.accessToken,
      user: session.user,
      memberships: session.memberships,
      status: 'authenticated',
    }),

  setAccessToken: (accessToken) => set({ accessToken }),

  setUser: (user, memberships) => set({ user, memberships, status: 'authenticated' }),

  markReady: () => set({ sessionReady: true }),

  clear: () =>
    set({
      accessToken: null,
      user: null,
      memberships: [],
      status: 'anonymous',
    }),
}));

export function findMembership(slug: string): MembershipSummary | null {
  return (
    useSessionStore
      .getState()
      .memberships.find((membership) => membership.organizationSlug === slug) ?? null
  );
}
