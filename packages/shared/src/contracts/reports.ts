import { z } from 'zod';

/* Reports, public statistics, platform administration and personal-data rights. */

/* ------------------------------------------------------------------ reports */

export interface EventSummaryReport {
  registrations: { total: number; byStatus: Record<string, number>; byCategory: { categoryName: string; count: number }[] };
  attendance: { checkedIn: number; rate: number };
  meetings: Record<string, number>;
  introductions: Record<string, number>;
  registrationsByDay: { day: string; count: number }[];
}

export interface OrganisationOverview {
  events: { total: number; byStatus: Record<string, number> };
  registrations: number;
  checkedIn: number;
  recentEvents: { id: string; name: string; status: string; startsAt: string; registrations: number }[];
}

export interface EditionComparison {
  editions: { eventId: string; name: string; startsAt: string; registrations: number; checkedIn: number }[];
}

export interface PublicEventStats {
  /** Counts under the anonymity threshold are reported as null so small groups stay private. */
  registrations: number | null;
  byCategory: { categoryName: string; count: number | null }[];
}

export interface PlatformOverview {
  organisations: { total: number; active: number };
  events: number;
  registrations: number;
  organisationList: { id: string; slug: string; name: string; status: string; events: number; createdAt: string }[];
}

export const setOrganisationStatusSchema = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) });
export type SetOrganisationStatusRequest = z.infer<typeof setOrganisationStatusSchema>;

/* ------------------------------------------------------------ data rights */

export const retentionSettingsSchema = z.object({
  retentionMonths: z.number().int().min(1).max(120).nullable(),
});
export type RetentionSettings = z.infer<typeof retentionSettingsSchema>;

export const purgeRequestSchema = z.object({ dryRun: z.boolean().default(true) });
export type PurgeRequest = z.infer<typeof purgeRequestSchema>;

export interface PurgeResult {
  dryRun: boolean;
  retentionMonths: number;
  cutoff: string;
  eligible: number;
  erased: number;
}

export interface ParticipantDataExport {
  exportedAt: string;
  person: { firstName: string; lastName: string; email: string; phone: string | null };
  registration: { id: string; status: string; category: string; answers: Record<string, unknown>; createdAt: string };
  consents: { purpose: string; policyVersion: string; granted: boolean; createdAt: string }[];
  profile: { headline: string; bio: string | null; tags: string[] } | null;
  innovations: { title: string; summary: string; sector: string | null }[];
  meetings: { message: string | null; status: string; createdAt: string }[];
  introductionRequests: { reason: string; helpOffered: string; status: string; createdAt: string }[];
  checkedInAt: string | null;
}

export const setPlatformModuleSchema = z.object({ available: z.boolean() });
export type SetPlatformModuleRequest = z.infer<typeof setPlatformModuleSchema>;

export interface PlatformModuleView {
  key: string;
  name: string;
  priority: 'core' | 'p0' | 'p1' | 'p2';
  /** Whether organisations may enable it on their events. */
  available: boolean;
  /** True when availability cannot be changed (the core, or a module not built yet). */
  locked: boolean;
}
