/**
 * Permission catalogue.
 *
 * Permissions are `resource:action` strings granted to per-organisation roles. The API is
 * the enforcement authority; the web app uses the same strings to hide controls it cannot
 * operate (convenience only).
 *
 * See docs/04-authentication-and-sessions.md.
 */

export const PERMISSIONS = {
  workspaceRead: 'workspace:read',
  workspaceManage: 'workspace:manage',

  memberRead: 'member:read',
  memberManage: 'member:manage',

  eventRead: 'event:read',
  eventManage: 'event:manage',
  eventPublish: 'event:publish',

  moduleManage: 'module:manage',

  registrationRead: 'registration:read',
  registrationManage: 'registration:manage',

  participantRead: 'participant:read',

  profileRead: 'profile:read',
  profileModerate: 'profile:moderate',

  meetingRead: 'meeting:read',
  meetingManage: 'meeting:manage',

  introductionRead: 'introduction:read',
  introductionManage: 'introduction:manage',

  checkinRead: 'checkin:read',
  checkinOperate: 'checkin:operate',

  reportRead: 'report:read',
  reportExport: 'report:export',

  auditRead: 'audit:read',

  /** Platform-level only. Never granted to an organisation role. */
  platformOrganizations: 'platform:organizations',
  platformModules: 'platform:modules',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSIONS);

/**
 * Platform permissions are deliberately excluded from organisation role templates.
 */
export const ORGANISATION_PERMISSIONS: PermissionKey[] = ALL_PERMISSIONS.filter(
  (permission) => !permission.startsWith('platform:'),
);

export const SYSTEM_ROLES = {
  organisationAdmin: 'organisation_admin',
  eventManager: 'event_manager',
  registrationManager: 'registration_manager',
  checkInStaff: 'checkin_staff',
  programmeManager: 'programme_manager',
  reportingOfficer: 'reporting_officer',
} as const;

export type SystemRoleKey = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

export interface SystemRoleTemplate {
  key: SystemRoleKey;
  name: string;
  description: string;
  permissions: PermissionKey[];
}

export const SYSTEM_ROLE_TEMPLATES: SystemRoleTemplate[] = [
  {
    key: SYSTEM_ROLES.organisationAdmin,
    name: 'Organisation Admin',
    description: 'Full control of the workspace, team, events and reports.',
    permissions: [
      PERMISSIONS.workspaceRead,
      PERMISSIONS.workspaceManage,
      PERMISSIONS.memberRead,
      PERMISSIONS.memberManage,
      PERMISSIONS.eventRead,
      PERMISSIONS.eventManage,
      PERMISSIONS.eventPublish,
      PERMISSIONS.moduleManage,
      PERMISSIONS.registrationRead,
      PERMISSIONS.registrationManage,
      PERMISSIONS.participantRead,
      PERMISSIONS.profileRead,
      PERMISSIONS.profileModerate,
      PERMISSIONS.meetingRead,
      PERMISSIONS.meetingManage,
      PERMISSIONS.introductionRead,
      PERMISSIONS.introductionManage,
      PERMISSIONS.checkinRead,
      PERMISSIONS.checkinOperate,
      PERMISSIONS.reportRead,
      PERMISSIONS.reportExport,
      PERMISSIONS.auditRead,
    ],
  },
  {
    key: SYSTEM_ROLES.eventManager,
    name: 'Event Manager',
    description: 'Configures and operates assigned events.',
    permissions: [
      PERMISSIONS.workspaceRead,
      PERMISSIONS.eventRead,
      PERMISSIONS.eventManage,
      PERMISSIONS.moduleManage,
      PERMISSIONS.registrationRead,
      PERMISSIONS.participantRead,
      PERMISSIONS.profileRead,
      PERMISSIONS.profileModerate,
      PERMISSIONS.meetingRead,
      PERMISSIONS.meetingManage,
      PERMISSIONS.introductionRead,
      PERMISSIONS.introductionManage,
      PERMISSIONS.checkinRead,
      PERMISSIONS.reportRead,
    ],
  },
  {
    key: SYSTEM_ROLES.registrationManager,
    name: 'Registration Manager',
    description: 'Reviews registrations, categories and participant records.',
    permissions: [
      PERMISSIONS.workspaceRead,
      PERMISSIONS.eventRead,
      PERMISSIONS.registrationRead,
      PERMISSIONS.registrationManage,
      PERMISSIONS.participantRead,
      PERMISSIONS.profileRead,
      PERMISSIONS.reportRead,
    ],
  },
  {
    key: SYSTEM_ROLES.checkInStaff,
    name: 'Check-in Staff',
    description: 'Scans badges and manages attendance on event day.',
    permissions: [
      PERMISSIONS.workspaceRead,
      PERMISSIONS.eventRead,
      PERMISSIONS.checkinRead,
      PERMISSIONS.checkinOperate,
      PERMISSIONS.participantRead,
    ],
  },
  {
    key: SYSTEM_ROLES.programmeManager,
    name: 'Programme Manager',
    description: 'Manages agenda and sessions when that module is enabled.',
    permissions: [
      PERMISSIONS.workspaceRead,
      PERMISSIONS.eventRead,
      PERMISSIONS.eventManage,
      PERMISSIONS.reportRead,
    ],
  },
  {
    key: SYSTEM_ROLES.reportingOfficer,
    name: 'Reporting Officer',
    description: 'Views and exports authorised reports.',
    permissions: [
      PERMISSIONS.workspaceRead,
      PERMISSIONS.eventRead,
      PERMISSIONS.reportRead,
      PERMISSIONS.reportExport,
    ],
  },
];

export function hasPermission(
  granted: readonly string[],
  required: readonly string[],
): boolean {
  if (required.length === 0) {
    return true;
  }
  return required.every((permission) => granted.includes(permission));
}
