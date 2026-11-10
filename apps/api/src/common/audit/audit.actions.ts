/**
 * The audit vocabulary. Dotted, past tense, one constant per recorded action.
 * Callers never pass a free-form string, so a typo cannot create a new action.
 */
export const AUDIT_ACTIONS = {
  signedIn: 'auth.signed_in',
  signedOut: 'auth.signed_out',
  mfaEnabled: 'auth.mfa.enabled',
  mfaDisabled: 'auth.mfa.disabled',
  brandingUpdated: 'workspace.branding.updated',
  settingsUpdated: 'workspace.settings.updated',
  eventPublished: 'event.published',
  eventUpdated: 'event.updated',
  eventTransitioned: 'event.transitioned',
  eventDuplicated: 'event.duplicated',
  eventModulesUpdated: 'event.modules.updated',
  memberInvited: 'member.invited',
  invitationRevoked: 'member.invitation.revoked',
  memberRoleChanged: 'member.role.changed',
  memberStatusChanged: 'member.status.changed',
  memberRemoved: 'member.removed',
  memberCapabilityAssigned: 'member.capability.assigned',
  memberCapabilityRevoked: 'member.capability.revoked',
  organizationCapabilityAssigned: 'organization.capability.assigned',
  organizationCapabilityRevoked: 'organization.capability.revoked',
  organizationCreated: 'organization.created',
  organizationSuspended: 'organization.suspended',
  organizationReactivated: 'organization.reactivated',
  platformOrganizationViewed: 'platform.organization.viewed',
  registrationSubmitted: 'registration.submitted',
  personErased: 'person.erased',
  registrationApproved: 'registration.approved',
  registrationRejected: 'registration.rejected',
  reportExportRequested: 'report.export.requested',
  checkInRecorded: 'checkin.recorded',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
