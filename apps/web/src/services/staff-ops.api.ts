import type {
  CheckInManifestEntry,
  CheckInStats,
  EditionComparison,
  EventSummaryReport,
  InnovationView,
  IntroductionView,
  MeetingView,
  OrganisationOverview,
  PlatformModuleView,
  PlatformOverview,
  PurgeResult,
  RetentionSettings,
  ProfileView,
  ScanRequest,
  ScanResult,
} from '@event-platform/shared';
import { apiRequest, apiRequestWithMeta } from './api-client';
import { env } from '@/lib/env';
import { useSessionStore } from '@/stores/session.store';

const ev = (slug: string, id: string): string => `/api/v1/workspaces/${slug}/events/${id}`;

/** Staff operations on one event: moderation, meetings, introductions, check-in, reports. */
export const staffOpsApi = {
  profiles: (slug: string, id: string) => apiRequest<ProfileView[]>(`${ev(slug, id)}/showcase/profiles`),
  innovations: (slug: string, id: string) => apiRequest<InnovationView[]>(`${ev(slug, id)}/showcase/innovations`),
  moderate: (slug: string, id: string, kind: 'profiles' | 'innovations', itemId: string, decision: 'APPROVE' | 'REJECT') =>
    apiRequest<void>(`${ev(slug, id)}/showcase/${kind}/${itemId}/moderation`, { method: 'POST', body: { decision } }),

  meetings: (slug: string, id: string) => apiRequest<MeetingView[]>(`${ev(slug, id)}/meetings`),
  confirmMeeting: (slug: string, id: string, meetingId: string) =>
    apiRequest<MeetingView>(`${ev(slug, id)}/meetings/${meetingId}/confirm`, { method: 'POST' }),
  meetingOutcome: (slug: string, id: string, meetingId: string, status: 'COMPLETED' | 'CANCELLED', outcome?: string) =>
    apiRequest<MeetingView>(`${ev(slug, id)}/meetings/${meetingId}/outcome`, { method: 'PUT', body: { status, outcome } }),

  async introductions(slug: string, id: string, status?: string) {
    const q = new URLSearchParams({ pageSize: '50' });
    if (status) q.set('status', status);
    return (await apiRequestWithMeta<IntroductionView[]>(`${ev(slug, id)}/introductions?${q}`)).data;
  },
  assignIntroduction: (slug: string, id: string, requestId: string, userId: string | null) =>
    apiRequest<IntroductionView>(`${ev(slug, id)}/introductions/${requestId}/assignee`, { method: 'PUT', body: { userId } }),
  decideIntroduction: (
    slug: string,
    id: string,
    requestId: string,
    payload: { status: string; note?: string; outcome?: string },
  ) => apiRequest<IntroductionView>(`${ev(slug, id)}/introductions/${requestId}/decision`, { method: 'POST', body: payload }),

  manifest: (slug: string, id: string) => apiRequest<CheckInManifestEntry[]>(`${ev(slug, id)}/check-in/manifest`),
  scan: (slug: string, id: string, payload: ScanRequest) =>
    apiRequest<ScanResult>(`${ev(slug, id)}/check-in/scans`, { method: 'POST', body: payload }),
  sync: (slug: string, id: string, scans: ScanRequest[]) =>
    apiRequest<ScanResult[]>(`${ev(slug, id)}/check-in/sync`, { method: 'POST', body: { scans } }),
  checkInStats: (slug: string, id: string) => apiRequest<CheckInStats>(`${ev(slug, id)}/check-in/stats`),
  lookup: (slug: string, id: string, q: string) =>
    apiRequest<{ registrationId: string; name: string; email: string; categoryName: string; checkedIn: boolean }[]>(
      `${ev(slug, id)}/check-in/lookup?q=${encodeURIComponent(q)}`,
    ),

  summary: (slug: string, id: string) => apiRequest<EventSummaryReport>(`${ev(slug, id)}/reports/summary`),
  editions: (slug: string, id: string) => apiRequest<EditionComparison>(`${ev(slug, id)}/reports/editions`),
  overview: (slug: string) => apiRequest<OrganisationOverview>(`/api/v1/workspaces/${slug}/reports/overview`),

  /** The export is a file, so it bypasses the JSON client and downloads through a blob. */
  async downloadRegistrationsCsv(slug: string, id: string): Promise<void> {
    const token = useSessionStore.getState().accessToken;
    const response = await fetch(`${env.apiUrl}${ev(slug, id)}/reports/registrations.csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('export_failed');
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = 'registrations.csv';
    link.click();
    URL.revokeObjectURL(url);
  },

  uploadBrandAsset: async (slug: string, kind: 'logo' | 'logo-dark' | 'favicon', file: File) => {
    const body = new FormData();
    body.append('file', file);
    const token = useSessionStore.getState().accessToken;
    const response = await fetch(`${env.apiUrl}/api/v1/workspaces/${slug}/branding/assets/${kind}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
      body,
    });
    const json = (await response.json()) as { data?: unknown; error?: { message: string } };
    if (!response.ok) {
      throw new Error(json.error?.message ?? 'upload_failed');
    }
    return json.data;
  },
};

const ws = (slug: string): string => `/api/v1/workspaces/${slug}`;

export const privacyApi = {
  retention: (slug: string) => apiRequest<RetentionSettings>(`${ws(slug)}/data-retention`),
  setRetention: (slug: string, retentionMonths: number | null) =>
    apiRequest<RetentionSettings>(`${ws(slug)}/data-retention`, { method: 'PUT', body: { retentionMonths } }),
  purge: (slug: string, dryRun: boolean) =>
    apiRequest<PurgeResult>(`${ws(slug)}/data-retention/purge`, { method: 'POST', body: { dryRun } }),
};

export interface AuditEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  actorEmail: string | null;
  createdAt: string;
}

export const auditApi = {
  async list(slug: string, page: number) {
    const env = await apiRequestWithMeta<AuditEntry[]>(`${ws(slug)}/audit-logs?page=${page}&pageSize=25`);
    return { items: env.data, total: env.meta.pagination?.total ?? env.data.length, pageSize: env.meta.pagination?.pageSize ?? 25 };
  },
};

export const platformApi = {
  modules: () => apiRequest<PlatformModuleView[]>('/api/v1/platform/modules'),
  setModule: (key: string, available: boolean) =>
    apiRequest<void>(`/api/v1/platform/modules/${key}`, { method: 'PUT', body: { available } }),
  overview: () => apiRequest<PlatformOverview>('/api/v1/platform/overview'),
  setStatus: (id: string, status: 'ACTIVE' | 'SUSPENDED') =>
    apiRequest<void>(`/api/v1/platform/organizations/${id}/status`, { method: 'PUT', body: { status } }),
};
