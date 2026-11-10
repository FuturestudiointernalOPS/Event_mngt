/**
 * The audit vocabulary. Dotted, past tense, one constant per recorded action.
 * Callers never pass a free-form string, so a typo cannot create a new action.
 */
export const AUDIT_ACTIONS = {
  signedIn: 'auth.signed_in',
  signedOut: 'auth.signed_out',
  brandingUpdated: 'workspace.branding.updated',
  settingsUpdated: 'workspace.settings.updated',
  eventPublished: 'event.published',
  eventModulesUpdated: 'event.modules.updated',
  memberInvited: 'member.invited',
  memberRoleChanged: 'member.role.changed',
  memberRemoved: 'member.removed',
  registrationSubmitted: 'registration.submitted',
  registrationApproved: 'registration.approved',
  registrationRejected: 'registration.rejected',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
