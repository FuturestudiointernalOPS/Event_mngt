import { z } from 'zod';
import { PERMISSIONS } from './permissions';

/**
 * The module registry is a controlled catalogue, not a marketplace.
 *
 * - The API validates activation, dependencies and settings.
 * - The web app renders the catalogue, explains dependencies and builds settings forms.
 * - Disabling a module never deletes its historical records.
 *
 * See docs/06-module-registry.md.
 */

export const modulePrioritySchema = z.enum(['core', 'p0', 'p1', 'p2']);
export type ModulePriority = z.infer<typeof modulePrioritySchema>;

export interface ModuleDefinition {
  key: string;
  name: string;
  summary: string;
  priority: ModulePriority;
  dependsOn: string[];
  requiredPermissions: string[];
  configurable: boolean;
  settingsSchema: z.ZodType;
  defaults: Record<string, unknown>;
}

const noSettings = z.object({});

export const MODULE_REGISTRY: ModuleDefinition[] = [
  {
    key: 'core',
    name: 'Event core',
    summary: 'Event identity, dates, venue, lifecycle and visibility.',
    priority: 'core',
    dependsOn: [],
    requiredPermissions: [PERMISSIONS.eventManage],
    configurable: false,
    settingsSchema: noSettings,
    defaults: {},
  },
  {
    key: 'publishing',
    name: 'Publishing & discovery',
    summary: 'Public event page, shareable link, listing and search.',
    priority: 'p0',
    dependsOn: ['core'],
    requiredPermissions: [PERMISSIONS.eventPublish],
    configurable: true,
    settingsSchema: z.object({
      showOnDiscovery: z.boolean().default(true),
      allowSharing: z.boolean().default(true),
    }),
    defaults: { showOnDiscovery: true, allowSharing: true },
  },
  {
    key: 'registration',
    name: 'Registration & badges',
    summary: 'Event-specific categories, configurable forms, consent, approval and QR badges.',
    priority: 'p0',
    dependsOn: ['core'],
    requiredPermissions: [PERMISSIONS.registrationManage],
    configurable: true,
    settingsSchema: z.object({
      approvalMode: z.enum(['manual', 'automatic']).default('manual'),
      requiresConsent: z.boolean().default(true),
      duplicatePolicy: z.enum(['warn', 'block']).default('warn'),
    }),
    defaults: { approvalMode: 'manual', requiresConsent: true, duplicatePolicy: 'warn' },
  },
  {
    key: 'showcase',
    name: 'Profiles & showcase',
    summary: 'Participant, company and innovation listings with staff approval.',
    priority: 'p0',
    dependsOn: ['registration'],
    requiredPermissions: [PERMISSIONS.profileModerate],
    configurable: true,
    settingsSchema: z.object({
      publicByDefault: z.boolean().default(false),
      allowParticipantEditing: z.boolean().default(true),
    }),
    defaults: { publicByDefault: false, allowParticipantEditing: true },
  },
  {
    key: 'meetings',
    name: 'Meetings & networking',
    summary: 'Declared interests and availability, proposals, accept/decline and outcomes.',
    priority: 'p0',
    dependsOn: ['showcase'],
    requiredPermissions: [PERMISSIONS.meetingManage],
    configurable: true,
    settingsSchema: z.object({
      requiresStaffConfirmation: z.boolean().default(true),
      maxProposalsPerParticipant: z.number().int().min(1).max(50).default(10),
    }),
    defaults: { requiresStaffConfirmation: true, maxProposalsPerParticipant: 10 },
  },
  {
    key: 'introductions',
    name: 'Introduction queue',
    summary: 'Interest requests, staff assignment, decisions, status history and outcomes.',
    priority: 'p0',
    dependsOn: ['showcase'],
    requiredPermissions: [PERMISSIONS.introductionManage],
    configurable: true,
    settingsSchema: z.object({
      requireReason: z.boolean().default(true),
      autoAssign: z.boolean().default(false),
    }),
    defaults: { requireReason: true, autoAssign: false },
  },
  {
    key: 'checkin',
    name: 'Check-in',
    summary: 'QR scanning, duplicate detection, attendance and offline synchronisation.',
    priority: 'p0',
    dependsOn: ['registration'],
    requiredPermissions: [PERMISSIONS.checkinOperate],
    configurable: true,
    settingsSchema: z.object({
      allowOffline: z.boolean().default(true),
      duplicateWindowMinutes: z.number().int().min(0).max(120).default(5),
      maxClockSkewMinutes: z.number().int().min(0).max(60).default(5),
    }),
    defaults: {
      allowOffline: true,
      duplicateWindowMinutes: 5,
      maxClockSkewMinutes: 5,
    },
  },
  {
    key: 'reporting',
    name: 'Dashboards & reports',
    summary: 'Live counts, event and organisation dashboards, exports and edition comparison.',
    priority: 'p0',
    dependsOn: ['core'],
    requiredPermissions: [PERMISSIONS.reportRead],
    configurable: false,
    settingsSchema: noSettings,
    defaults: {},
  },
  {
    key: 'agenda',
    name: 'Agenda & sessions',
    summary: 'Schedule, rooms, speakers, reminders and session information.',
    priority: 'p1',
    dependsOn: ['core'],
    requiredPermissions: [PERMISSIONS.eventManage],
    configurable: true,
    settingsSchema: z.object({
      showSpeakers: z.boolean().default(true),
      allowWaitlists: z.boolean().default(false),
    }),
    defaults: { showSpeakers: true, allowWaitlists: false },
  },
  {
    key: 'surveys',
    name: 'Surveys & follow-up',
    summary: 'Post-event feedback forms and outcome tracking at defined intervals.',
    priority: 'p1',
    dependsOn: ['registration'],
    requiredPermissions: [PERMISSIONS.registrationManage],
    configurable: true,
    settingsSchema: z.object({
      followUpDays: z.number().int().min(1).max(365).default(14),
    }),
    defaults: { followUpDays: 14 },
  },
  {
    key: 'sponsors',
    name: 'Sponsor portal',
    summary: 'Sponsor visibility, agreed engagement information and reporting.',
    priority: 'p2',
    dependsOn: ['core'],
    requiredPermissions: [PERMISSIONS.eventManage],
    configurable: true,
    settingsSchema: noSettings,
    defaults: {},
  },
  {
    key: 'ai',
    name: 'AI assistance',
    summary: 'Auto-tagging, listing summaries and meeting briefs.',
    priority: 'p2',
    dependsOn: ['showcase'],
    requiredPermissions: [PERMISSIONS.eventManage],
    configurable: true,
    settingsSchema: z.object({
      enableSummaries: z.boolean().default(false),
      enableMeetingBriefs: z.boolean().default(false),
    }),
    defaults: { enableSummaries: false, enableMeetingBriefs: false },
  },
];

export const MODULE_KEYS = MODULE_REGISTRY.map((module) => module.key);

export function getModuleDefinition(key: string): ModuleDefinition | undefined {
  return MODULE_REGISTRY.find((module) => module.key === key);
}

/**
 * Modules that must also be enabled. Returns the full transitive closure, excluding the
 * module itself, so the API can reject activation with a complete list of missing keys.
 */
export function resolveDependencies(key: string): string[] {
  const resolved = new Set<string>();
  const visit = (currentKey: string): void => {
    const definition = getModuleDefinition(currentKey);
    if (!definition) {
      return;
    }
    for (const dependency of definition.dependsOn) {
      if (!resolved.has(dependency)) {
        resolved.add(dependency);
        visit(dependency);
      }
    }
  };
  visit(key);
  resolved.delete(key);
  return [...resolved];
}

export function missingDependencies(key: string, enabled: readonly string[]): string[] {
  const enabledSet = new Set([...enabled, key]);
  return resolveDependencies(key).filter((dependency) => !enabledSet.has(dependency));
}

export interface ModuleSettingsIssue {
  path: string;
  message: string;
}

export function validateModuleSettings(
  key: string,
  settings: unknown,
):
  | { success: true; data: Record<string, unknown> }
  | { success: false; issues: ModuleSettingsIssue[] } {
  const definition = getModuleDefinition(key);
  if (!definition) {
    return { success: false, issues: [{ path: '', message: `Unknown module "${key}"` }] };
  }
  const parsed = definition.settingsSchema.safeParse(settings ?? {});
  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }
  return { success: true, data: parsed.data as Record<string, unknown> };
}
