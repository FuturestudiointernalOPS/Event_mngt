import {
  API_PATHS,
  type CreateEventRequest,
  type EventDetail,
  type EventSummary,
} from '@event-platform/shared';
import { apiRequest, apiRequestWithMeta } from './api-client';

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface EventFilters {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
}

export interface PublicEventContextView {
  event: {
    slug: string;
    name: string;
    description: string | null;
    format: string;
    visibility: string;
    timeZone: string;
    startsAt: string;
    endsAt: string;
    venueName: string | null;
    venueAddress: string | null;
  };
  organization: { slug: string; name: string };
  branding: import('@event-platform/shared').Branding;
  locale: {
    default: 'fr' | 'en';
    supported: Array<'fr' | 'en'>;
  };
}

export const eventsApi = {
  async list(slug: string, filters: EventFilters = {}): Promise<Paged<EventSummary>> {
    const parameters = new URLSearchParams();
    parameters.set('page', String(filters.page ?? 1));
    parameters.set('pageSize', String(filters.pageSize ?? 20));
    if (filters.status) {
      parameters.set('status', filters.status);
    }
    if (filters.search) {
      parameters.set('search', filters.search);
    }

    const envelope = await apiRequestWithMeta<EventSummary[]>(
      `${API_PATHS.events.list(slug)}?${parameters.toString()}`,
    );

    return {
      items: envelope.data,
      page: envelope.meta.pagination?.page ?? 1,
      pageSize: envelope.meta.pagination?.pageSize ?? 20,
      total: envelope.meta.pagination?.total ?? envelope.data.length,
    };
  },

  create(slug: string, payload: CreateEventRequest): Promise<EventDetail> {
    return apiRequest<EventDetail>(API_PATHS.events.list(slug), {
      method: 'POST',
      body: payload,
    });
  },

  detail(slug: string, eventId: string): Promise<EventDetail> {
    return apiRequest<EventDetail>(API_PATHS.events.detail(slug, eventId));
  },

  publish(slug: string, eventId: string): Promise<EventDetail> {
    return apiRequest<EventDetail>(API_PATHS.events.publish(slug, eventId), {
      method: 'POST',
    });
  },

  publicContext(eventSlug: string): Promise<PublicEventContextView> {
    return apiRequest<PublicEventContextView>(API_PATHS.publicEvents.context(eventSlug));
  },
};
