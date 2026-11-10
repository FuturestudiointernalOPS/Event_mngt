import type {
  Category,
  ConsentDocument,
  CreateCategoryRequest,
  CreateConsentDocumentRequest,
  DecideRegistrationRequest,
  EventDetail,
  EventModule,
  ModuleCatalogueEntry,
  RegistrationDetail,
  RegistrationForm,
  RegistrationSummary,
  SaveRegistrationFormRequest,
  UpdateCategoryRequest,
  UpdateEventModulesRequest,
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

  /** The shared registry: names, summaries and dependencies for every module. */
  moduleCatalogue: () => apiRequest<ModuleCatalogueEntry[]>('/api/v1/modules'),
  modules: (slug: string, id: string) => apiRequest<EventModule[]>(`${ev(slug, id)}/modules`),
  setModules: (slug: string, id: string, payload: UpdateEventModulesRequest) =>
    apiRequest<EventModule[]>(`${ev(slug, id)}/modules`, { method: 'PATCH', body: payload }),

  categories: (slug: string, id: string) => apiRequest<Category[]>(`${ev(slug, id)}/categories`),
  addCategory: (slug: string, id: string, payload: CreateCategoryRequest) =>
    apiRequest<Category>(`${ev(slug, id)}/categories`, { method: 'POST', body: payload }),
  updateCategory: (slug: string, id: string, categoryId: string, payload: UpdateCategoryRequest) =>
    apiRequest<Category>(`${ev(slug, id)}/categories/${categoryId}`, {
      method: 'PATCH',
      body: payload,
    }),
  deleteCategory: (slug: string, id: string, categoryId: string) =>
    apiRequest<void>(`${ev(slug, id)}/categories/${categoryId}`, { method: 'DELETE' }),

  /** The registration form is one versioned document, not a set of field rows. */
  registrationForm: (slug: string, id: string) =>
    apiRequest<RegistrationForm | null>(`${ev(slug, id)}/registration-form`),
  saveRegistrationForm: (slug: string, id: string, payload: SaveRegistrationFormRequest) =>
    apiRequest<RegistrationForm>(`${ev(slug, id)}/registration-form`, {
      method: 'PUT',
      body: payload,
    }),

  /** Consent documents are versioned: a new version supersedes the previous one. */
  consentDocuments: (slug: string, id: string) =>
    apiRequest<ConsentDocument[]>(`${ev(slug, id)}/consent-documents`),
  addConsentDocument: (slug: string, id: string, payload: CreateConsentDocumentRequest) =>
    apiRequest<ConsentDocument>(`${ev(slug, id)}/consent-documents`, {
      method: 'POST',
      body: payload,
    }),

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
  approve: (slug: string, id: string, registrationId: string, payload: DecideRegistrationRequest) =>
    apiRequest<RegistrationDetail>(`${ev(slug, id)}/registrations/${registrationId}/approve`, {
      method: 'POST',
      body: payload,
    }),
  reject: (slug: string, id: string, registrationId: string, payload: DecideRegistrationRequest) =>
    apiRequest<RegistrationDetail>(`${ev(slug, id)}/registrations/${registrationId}/reject`, {
      method: 'POST',
      body: payload,
    }),
  /** Anonymises the person behind the registration; the row survives so counts stay honest. */
  erase: (slug: string, id: string, registrationId: string) =>
    apiRequest<void>(`${ev(slug, id)}/registrations/${registrationId}/erase`, { method: 'POST' }),
};
