import type {
  DirectoryEntry,
  InnovationInput,
  InnovationView,
  IntroductionView,
  MeetingView,
  ParticipantDataExport,
  ProfileView,
  ProposeMeetingRequest,
  RequestIntroductionRequest,
  RespondMeetingRequest,
  UpsertProfileRequest,
} from '@event-platform/shared';
import { apiRequest } from './api-client';

export interface ParticipantOverview {
  registrationId: string;
  status: string;
  firstName: string;
  lastName: string;
  categoryName: string;
  event: {
    name: string;
    slug: string;
    startsAt: string;
    endsAt: string;
    timeZone: string;
    venueName: string | null;
    venueAddress: string | null;
  };
  badgeCode: string | null;
  checkedIn: boolean;
  modules: string[];
}

const TOKEN_KEY = 'ep.participant-token';

/** The portal credential lives in sessionStorage only: it ends with the browser tab. */
export const participantToken = {
  get(): string | null {
    try {
      return window.sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      window.sessionStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable: the page keeps working for this load only */
    }
  },
  clear(): void {
    try {
      window.sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* nothing to clear */
    }
  },
};

function call<T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: unknown) {
  return apiRequest<T>(`/api/v1/participant${path}`, {
    method,
    body,
    headers: { 'x-participant-token': participantToken.get() ?? '' },
  });
}

export const participantApi = {
  me: () => call<ParticipantOverview>('/me'),
  cancel: () => call<{ status: string }>('/cancel', 'POST'),
  exportData: () => call<ParticipantDataExport>('/export'),
  erase: () => call<void>('/erase', 'POST'),
  profile: () => call<ProfileView | null>('/profile'),
  saveProfile: (payload: UpsertProfileRequest) => call<ProfileView>('/profile', 'PUT', payload),
  innovations: () => call<InnovationView[]>('/innovations'),
  addInnovation: (payload: InnovationInput) => call<InnovationView>('/innovations', 'POST', payload),
  removeInnovation: (id: string) => call<void>(`/innovations/${id}`, 'DELETE'),
  directory: () => call<DirectoryEntry[]>('/directory'),
  showcaseInnovations: () => call<InnovationView[]>('/showcase-innovations'),
  meetings: () => call<MeetingView[]>('/meetings'),
  propose: (payload: ProposeMeetingRequest) => call<MeetingView>('/meetings', 'POST', payload),
  respond: (id: string, payload: RespondMeetingRequest) =>
    call<MeetingView>(`/meetings/${id}/respond`, 'POST', payload),
  introductions: () => call<IntroductionView[]>('/introductions'),
  requestIntroduction: (payload: RequestIntroductionRequest) =>
    call<IntroductionView>('/introductions', 'POST', payload),
};
