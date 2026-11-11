import type {
  CreateIntroductionRequest,
  IntroductionRequest,
  Meeting,
  ParticipantDataExport,
  ParticipantDirectoryEntry,
  ParticipantMeetingRequest,
  ParticipantMeetingResponse,
  ParticipantOverview,
  ParticipantProfile,
  UpdateParticipantProfileRequest,
} from '@event-platform/shared';
import { apiRequest } from './api-client';

const KEY = 'ep.participant-credential';

/**
 * The credential from the e-mailed link lives in sessionStorage only: it ends with the
 * browser tab and is never written to localStorage or sent anywhere but our own API.
 */
export const participantCredential = {
  get(): string | null {
    try {
      return window.sessionStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set(value: string): void {
    try {
      window.sessionStorage.setItem(KEY, value);
    } catch {
      /* storage unavailable: the page still works for this load */
    }
  },
  clear(): void {
    try {
      window.sessionStorage.removeItem(KEY);
    } catch {
      /* nothing to clear */
    }
  },
};

function call<T>(path: string, method: 'GET' | 'POST' | 'PUT' = 'GET', body?: unknown): Promise<T> {
  return apiRequest<T>(`/api/v1/participant${path}`, {
    method,
    body,
    headers: { 'x-participant-credential': participantCredential.get() ?? '' },
  });
}

export const participantApi = {
  me: () => call<ParticipantOverview>('/me'),
  exportData: () => call<ParticipantDataExport>('/export'),
  withdraw: () => call<void>('/withdraw', 'POST'),
  erase: () => call<void>('/erase', 'POST'),
  profile: () => call<ParticipantProfile | null>('/profile'),
  saveProfile: (payload: UpdateParticipantProfileRequest) => call<ParticipantProfile>('/profile', 'PUT', payload),
  directory: () => call<ParticipantDirectoryEntry[]>('/directory'),
  meetings: () => call<Meeting[]>('/meetings'),
  propose: (payload: ParticipantMeetingRequest) => call<Meeting>('/meetings', 'POST', payload),
  respond: (meetingId: string, payload: ParticipantMeetingResponse) =>
    call<Meeting>(`/meetings/${meetingId}/respond`, 'POST', payload),
  introductions: () => call<IntroductionRequest[]>('/introductions'),
  requestIntroduction: (payload: Omit<CreateIntroductionRequest, 'requestingProfileId'>) =>
    call<IntroductionRequest>('/introductions', 'POST', payload),
};
