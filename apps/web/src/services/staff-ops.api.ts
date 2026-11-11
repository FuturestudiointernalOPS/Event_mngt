import type {
  AuditEntry,
  CheckIn,
  CheckInSummary,
  CreateCheckInRequest,
  CreateReportExportRequest,
  EditionComparison,
  EventReport,
  Innovation,
  IntroductionRequest,
  IntroductionRequestDetail,
  Meeting,
  ModerateProfileRequest,
  OrganizationProfile,
  OrganizationReport,
  ParticipantProfile,
  RegistrationSummary,
  ReportExport,
  SyncCheckInsRequest,
  SyncCheckInsResponse,
  UpdateIntroductionRequest,
  UpdateMeetingRequest,
} from '@event-platform/shared';
import { apiRequest, apiRequestWithMeta } from './api-client';
import { env } from '@/lib/env';
import { useSessionStore } from '@/stores/session.store';

const ws = (slug: string): string => `/api/v1/workspaces/${slug}`;
const ev = (slug: string, id: string): string => `${ws(slug)}/events/${id}`;

/** Paginated endpoints answer with the same envelope; this unwraps it once. */
async function page<T>(
  path: string,
): Promise<{ items: T[]; total: number; pageSize: number }> {
  const envelope = await apiRequestWithMeta<T[]>(path);
  return {
    items: envelope.data,
    total: envelope.meta.pagination?.total ?? envelope.data.length,
    pageSize: envelope.meta.pagination?.pageSize ?? envelope.data.length,
  };
}

/** Staff operations on one event: moderation, meetings, introductions, check-in, reports. */
export const staffOpsApi = {
  profiles: (slug: string, id: string, pageNumber = 1) =>
    page<ParticipantProfile>(`${ev(slug, id)}/profiles?page=${pageNumber}&pageSize=50`),
  innovations: (slug: string, id: string, pageNumber = 1) =>
    page<Innovation>(`${ev(slug, id)}/showcase?page=${pageNumber}&pageSize=50`),
  moderateProfile: (slug: string, id: string, profileId: string, body: ModerateProfileRequest) =>
    apiRequest<ParticipantProfile>(`${ev(slug, id)}/profiles/${profileId}/moderate`, {
      method: 'POST',
      body,
    }),
  moderateInnovation: (
    slug: string,
    id: string,
    innovationId: string,
    body: ModerateProfileRequest,
  ) =>
    apiRequest<Innovation>(`${ev(slug, id)}/showcase/${innovationId}/moderate`, {
      method: 'POST',
      body,
    }),

  organizationProfile: (slug: string) =>
    apiRequest<OrganizationProfile | null>(`${ws(slug)}/organization-profile`),
  moderateOrganizationProfile: (slug: string, body: ModerateProfileRequest) =>
    apiRequest<OrganizationProfile>(`${ws(slug)}/organization-profile/moderate`, {
      method: 'POST',
      body,
    }),

  meetings: (slug: string, id: string) => page<Meeting>(`${ev(slug, id)}/meetings?pageSize=50`),
  updateMeeting: (slug: string, id: string, meetingId: string, body: UpdateMeetingRequest) =>
    apiRequest<Meeting>(`${ev(slug, id)}/meetings/${meetingId}`, { method: 'PATCH', body }),

  introductions: (slug: string, id: string, status?: string) => {
    const query = new URLSearchParams({ pageSize: '50' });
    if (status) query.set('status', status);
    return page<IntroductionRequest>(`${ev(slug, id)}/introductions?${query}`);
  },
  introduction: (slug: string, id: string, requestId: string) =>
    apiRequest<IntroductionRequestDetail>(`${ev(slug, id)}/introductions/${requestId}`),
  updateIntroduction: (
    slug: string,
    id: string,
    requestId: string,
    body: UpdateIntroductionRequest,
  ) =>
    apiRequest<IntroductionRequest>(`${ev(slug, id)}/introductions/${requestId}`, {
      method: 'PATCH',
      body,
    }),

  checkIns: (slug: string, id: string, pageNumber = 1) =>
    page<CheckIn>(`${ev(slug, id)}/check-ins?page=${pageNumber}&pageSize=50`),
  recordCheckIn: (slug: string, id: string, body: CreateCheckInRequest) =>
    apiRequest<CheckIn>(`${ev(slug, id)}/check-ins`, { method: 'POST', body }),
  syncCheckIns: (slug: string, id: string, body: SyncCheckInsRequest) =>
    apiRequest<SyncCheckInsResponse>(`${ev(slug, id)}/check-ins/sync`, { method: 'POST', body }),
  checkInSummary: (slug: string, id: string) =>
    apiRequest<CheckInSummary>(`${ev(slug, id)}/check-ins/summary`),
  searchRegistrations: (slug: string, id: string, search: string) =>
    page<RegistrationSummary>(
      `${ev(slug, id)}/registrations?search=${encodeURIComponent(search)}&pageSize=10`,
    ),

  report: (slug: string, id: string) => apiRequest<EventReport>(`${ev(slug, id)}/reports/summary`),
  editions: (slug: string, id: string) =>
    apiRequest<EditionComparison>(`${ev(slug, id)}/reports/editions`),
  overview: (slug: string) => apiRequest<OrganizationReport>(`${ws(slug)}/reports/summary`),

  createExport: (slug: string, id: string, body: CreateReportExportRequest) =>
    apiRequest<ReportExport>(`${ev(slug, id)}/exports`, { method: 'POST', body }),
  exports: (slug: string, id: string) => page<ReportExport>(`${ev(slug, id)}/exports`),
  exportDetail: (slug: string, exportId: string) =>
    apiRequest<ReportExport>(`${ws(slug)}/exports/${exportId}`),

  /** The download is a file, so it bypasses the JSON client and streams through a blob. */
  async downloadExport(slug: string, exportId: string): Promise<void> {
    const token = useSessionStore.getState().accessToken;
    const response = await fetch(`${env.apiUrl}${ws(slug)}/exports/${exportId}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('export_failed');
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = `${exportId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  },

  uploadBrandAsset: async (slug: string, kind: 'logo' | 'logo-dark' | 'favicon', file: File) => {
    const body = new FormData();
    body.append('file', file);
    const token = useSessionStore.getState().accessToken;
    const response = await fetch(`${env.apiUrl}${ws(slug)}/branding/assets/${kind}`, {
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

export const auditApi = {
  list: (slug: string, pageNumber: number) =>
    page<AuditEntry>(`${ws(slug)}/audit?page=${pageNumber}&pageSize=25`),
};
