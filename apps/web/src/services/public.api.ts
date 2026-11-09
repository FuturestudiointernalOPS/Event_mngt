import type {
  PublicEventStats,
  PublicRegistrationForm,
  PublicRegistrationResult,
  PublicShowcase,
  SubmitRegistrationRequest,
} from '@event-platform/shared';
import { apiRequest } from './api-client';

const pub = (eventSlug: string): string => `/api/v1/public/events/${eventSlug}`;

export const publicApi = {
  form: (eventSlug: string) => apiRequest<PublicRegistrationForm>(`${pub(eventSlug)}/registration-form`),
  /** A fresh idempotency key per form instance makes a double click or retry safe. */
  register: (eventSlug: string, payload: SubmitRegistrationRequest, idempotencyKey: string) =>
    apiRequest<PublicRegistrationResult>(`${pub(eventSlug)}/registrations`, {
      method: 'POST',
      body: payload,
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  showcase: (eventSlug: string) => apiRequest<PublicShowcase>(`${pub(eventSlug)}/showcase`),
  stats: (eventSlug: string) => apiRequest<PublicEventStats>(`${pub(eventSlug)}/stats`),
};
