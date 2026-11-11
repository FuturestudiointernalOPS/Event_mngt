import { z } from 'zod';
import { uuidSchema } from './common';

/** What a registrant sees in their own space. No other participant's data is ever included. */

export interface ParticipantOverview {
  reference: string;
  status: 'APPROVED';
  person: { firstName: string; lastName: string };
  category: { key: string; name: string } | null;
  event: {
    name: string;
    slug: string;
    startsAt: string;
    endsAt: string;
    timeZone: string;
    venueName: string | null;
    venueAddress: string | null;
  };
  badge: { reference: string; qrPayload: string };
  checkedIn: boolean;
  /** Module keys enabled for the event, so the space only offers what exists. */
  modules: string[];
}

export interface ParticipantDataExport {
  exportedAt: string;
  person: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    organizationName: string | null;
    jobTitle: string | null;
    country: string | null;
  };
  registration: { reference: string; status: string; submittedAt: string; category: string | null };
  answers: { fieldKey: string; value: unknown }[];
  consents: { key: string; version: number; acceptedAt: string }[];
  profile: { headline: string | null; bio: string | null; company: string | null; jobTitle: string | null } | null;
  checkedInAt: string | null;
}

export const participantMeetingRequestSchema = z.object({
  recipientProfileId: uuidSchema,
  durationMinutes: z.number().int().min(10).max(240).optional(),
  note: z.string().trim().max(500).optional(),
});
export type ParticipantMeetingRequest = z.infer<typeof participantMeetingRequestSchema>;

export const participantMeetingResponseSchema = z.object({
  action: z.enum(['accept', 'decline', 'cancel']),
});
export type ParticipantMeetingResponse = z.infer<typeof participantMeetingResponseSchema>;

/** Another participant as seen in the directory: a display name and a presentation, no contact data. */
export interface ParticipantDirectoryEntry {
  profileId: string;
  displayName: string;
  headline: string | null;
  company: string | null;
  jobTitle: string | null;
}
