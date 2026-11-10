/**
 * Typed capability constants.
 *
 * The registry in `capability-definitions.ts` is authoritative; this map exists so a
 * typo cannot silently invent a capability. `capability-registry.spec.ts` fails when the
 * two drift apart.
 */
export const CAPABILITY_KEYS = {
  organizationView: 'organization.view',
  organizationEdit: 'organization.edit',
  organizationManageBranding: 'organization.manage_branding',
  organizationViewMembers: 'organization.view_members',
  organizationInviteMembers: 'organization.invite_members',
  organizationRemoveMembers: 'organization.remove_members',
  organizationManagePermissions: 'organization.manage_permissions',
  organizationViewAuditLog: 'organization.view_audit_log',

  eventsView: 'events.view',
  eventsCreate: 'events.create',
  eventsPublish: 'events.publish',
  eventsViewModules: 'events.view_modules',
  eventsManageModules: 'events.manage_modules',
  editionsView: 'editions.view',
  editionsCreate: 'editions.create',

  registrationsView: 'registrations.view',
  registrationsApprove: 'registrations.approve',
  registrationsReject: 'registrations.reject',
  registrationsViewCategories: 'registrations.view_categories',
  registrationsManageCategories: 'registrations.manage_categories',
  registrationsViewForm: 'registrations.view_form',
  registrationsManageForm: 'registrations.manage_form',
  registrationsErase: 'registrations.erase',
  registrationsViewConsent: 'registrations.view_consent',
  registrationsManageConsent: 'registrations.manage_consent',
  registrationsViewBadges: 'registrations.view_badges',
  registrationsManageBadges: 'registrations.manage_badges',

  participantsView: 'participants.view',

  profilesView: 'profiles.view',
  profilesEdit: 'profiles.edit',
  profilesModerate: 'profiles.moderate',

  checkInView: 'check_in.view',
  checkInOperate: 'check_in.operate',

  meetingsView: 'meetings.view',
  meetingsManage: 'meetings.manage',

  introductionsView: 'introductions.view',
  introductionsManage: 'introductions.manage',

  reportsView: 'reports.view',
  reportsExport: 'reports.export',

  platformOrganizationsManage: 'platform.organizations.manage',
  platformCapabilitiesView: 'platform.capabilities.view',
} as const;
