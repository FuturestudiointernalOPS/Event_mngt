import type {
  CategoryInput,
  CategoryView,
  ConsentSettings,
  DecideRegistrationRequest,
  EventDetail,
  EventModuleView,
  FieldInput,
  FieldView,
  RegistrationDetail,
  RegistrationSummary,
  SetEventModuleRequest,
  UpdateEventRequest,
} from '@event-platform/shared';
import { apiRequest, apiRequestWithMeta } from './api-client';
import type { Paged } from './events.api';

const ev = (slug: string, id: string): string => `/api/v1/workspaces/${slug}/events/${id}`;

export type EventAction =
  | 'publish'
  | 'unpublish'
  | 'complete'
  | 'cancel'
  | 'archive'
  | 'duplicate'
  | 'open-registration'
  | 'close-registration';

/** Staff-side configuration and review of one event. */
export const eventAdminApi = {
  update: (slug: string, id: string, payload: UpdateEventRequest) =>
    apiRequest<EventDetail>(ev(slug, id), { method: 'PATCH', body: payload }),
  act: (slug: string, id: string, action: EventAction) =>
    apiRequest<EventDetail>(`${ev(slug, id)}/${action}`, { method: 'POST' }),

  modules: (slug: string, id: string) => apiRequest<EventModuleView[]>(`${ev(slug, id)}/modules`),
  setModule: (slug: string, id: string, key: string, payload: SetEventModuleRequest) =>
    apiRequest<EventModuleView[]>(`${ev(slug, id)}/modules/${key}`, { method: 'PUT', body: payload }),

  categories: (slug: string, id: string) => apiRequest<CategoryView[]>(`${ev(slug, id)}/categories`),
  addCategory: (slug: string, id: string, payload: CategoryInput) =>
    apiRequest<CategoryView[]>(`${ev(slug, id)}/categories`, { method: 'POST', body: payload }),
  updateCategory: (slug: string, id: string, categoryId: string, payload: Record<string, unknown>) =>
    apiRequest<CategoryView[]>(`${ev(slug, id)}/categories/${categoryId}`, { method: 'PATCH', body: payload }),
  deleteCategory: (slug: string, id: string, categoryId: string) =>
    apiRequest<void>(`${ev(slug, id)}/categories/${categoryId}`, { method: 'DELETE' }),

  fields: (slug: string, id: string) => apiRequest<FieldView[]>(`${ev(slug, id)}/form-fields`),
  addField: (slug: string, id: string, payload: FieldInput) =>
    apiRequest<FieldView[]>(`${ev(slug, id)}/form-fields`, { method: 'POST', body: payload }),
  deleteField: (slug: string, id: string, fieldId: string) =>
    apiRequest<void>(`${ev(slug, id)}/form-fields/${fieldId}`, { method: 'DELETE' }),

  consent: (slug: string, id: string) =>
    apiRequest<{ text: string | null; version: string }>(`${ev(slug, id)}/consent`),
  setConsent: (slug: string, id: string, payload: ConsentSettings) =>
    apiRequest<{ text: string | null; version: string }>(`${ev(slug, id)}/consent`, { method: 'PUT', body: payload }),

  async registrations(
    slug: string,
    id: string,
    filters: { page?: number; status?: string; search?: string },
  ): Promise<Paged<RegistrationSummary>> {
    const q = new URLSearchParams({ page: String(filters.page ?? 1), pageSize: '20' });
    if (filters.status) q.set('status', filters.status);
    if (filters.search) q.set('search', filters.search);
    const env = await apiRequestWithMeta<RegistrationSummary[]>(`${ev(slug, id)}/registrations?${q}`);
    return {
      items: env.data,
      page: env.meta.pagination?.page ?? 1,
      pageSize: env.meta.pagination?.pageSize ?? 20,
      total: env.meta.pagination?.total ?? env.data.length,
    };
  },
  registration: (slug: string, id: string, registrationId: string) =>
    apiRequest<RegistrationDetail>(`${ev(slug, id)}/registrations/${registrationId}`),
  decide: (slug: string, id: string, registrationId: string, payload: DecideRegistrationRequest) =>
    apiRequest<RegistrationDetail>(`${ev(slug, id)}/registrations/${registrationId}/decision`, {
      method: 'POST',
      body: payload,
    }),
  erase: (slug: string, id: string, registrationId: string) =>
    apiRequest<void>(`${ev(slug, id)}/registrations/${registrationId}/erase`, { method: 'POST' }),
  resendAccess: (slug: string, id: string, registrationId: string) =>
    apiRequest<void>(`${ev(slug, id)}/registrations/${registrationId}/resend-access`, { method: 'POST' }),
};
