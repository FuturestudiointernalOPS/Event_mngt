import type { AuthUser, MembershipSummary } from '@event-platform/shared';

/** Request metadata captured when a session is created or rotated. */
export interface SessionMeta {
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface LoginResult {
  session: {
    user: AuthUser;
    memberships: MembershipSummary[];
    accessToken: string;
    expiresIn: number;
  };
  refreshToken: string;
}

export interface RefreshedSession {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}
