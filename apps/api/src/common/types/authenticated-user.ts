/**
 * Claims carried by the short-lived access token. Minimal by design: no tenant
 * identifiers, no permissions. Those are resolved per request from the database so
 * revocation, role changes and membership removal take effect immediately.
 */
export interface AccessTokenPayload {
  /** User id */
  sub: string;
  /** Session id, so a session can be revoked while its access token is still valid */
  sid: string;
  email: string;
  /** Token type discriminator: always 'access' */
  typ: 'access';
  /** Platform administrator flag (platform console only) */
  pad?: boolean;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  sessionId: string;
  isPlatformAdmin: boolean;
}

/** Result of resolving a workspace slug for the authenticated user. */
export interface TenantAccess {
  organizationId: string;
  membershipId: string;
  roleKey: string;
  permissions: string[];
}

/**
 * A registered participant acting through the portal credential they were e-mailed.
 * The organisation was proven by the credential's secret, not trusted from the client.
 */
export interface ParticipantAccess {
  organizationId: string;
  registrationId: string;
  eventId: string;
  status: string;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
