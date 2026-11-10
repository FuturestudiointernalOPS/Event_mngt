# 15 — Route catalogue

Every feature module has a `routes.ts` beside its controllers. It lists each route's
method, path, required permission and controller method, grouped by module. The
controllers remain the handlers.

The catalogue is not decorative. `apps/api/src/common/routes/routes.spec.ts` reads the
route metadata Nest stores on the real controllers and compares it with these files. A
route added without an entry, an entry left behind by a removed controller, or a changed
permission fails the test. The same spec compares the table below with the catalogues, so
the documentation cannot silently drift either.

Paths are relative to `/api/v1`. `—` means the route is public or only needs a session.

<!-- routes:start -->
| Module | Method | Path | Permission | Handler |
| --- | --- | --- | --- | --- |
| audit | GET | `/workspaces/:slug/audit` | `audit:read` | `AuditController.list` |
| auth | POST | `/auth/register` | — | `AuthController.register` |
| auth | POST | `/auth/verify-email` | — | `AuthController.verifyEmail` |
| auth | POST | `/auth/login` | — | `AuthController.login` |
| auth | POST | `/auth/refresh` | — | `AuthController.refresh` |
| auth | POST | `/auth/logout` | — | `AuthController.logout` |
| auth | POST | `/auth/forgot-password` | — | `AuthController.forgotPassword` |
| auth | POST | `/auth/reset-password` | — | `AuthController.resetPassword` |
| auth | GET | `/auth/me` | — | `AuthController.me` |
| auth | GET | `/auth/sessions` | — | `AuthController.sessions` |
| auth | DELETE | `/auth/sessions/:sessionId` | — | `AuthController.revokeSession` |
| badges | GET | `/workspaces/:slug/events/:eventId/badges` | `registration:read` | `BadgesController.list` |
| badges | GET | `/workspaces/:slug/events/:eventId/registrations/:registrationId/badge` | `registration:read` | `BadgesController.detail` |
| badges | POST | `/workspaces/:slug/events/:eventId/registrations/:registrationId/badge/reissue` | `registration:manage` | `BadgesController.reissue` |
| badges | POST | `/workspaces/:slug/events/:eventId/registrations/:registrationId/badge/revoke` | `registration:manage` | `BadgesController.revoke` |
| check-in | POST | `/workspaces/:slug/events/:eventId/check-ins` | `checkin:operate` | `CheckInsController.record` |
| check-in | POST | `/workspaces/:slug/events/:eventId/check-ins/sync` | `checkin:operate` | `CheckInsController.sync` |
| check-in | GET | `/workspaces/:slug/events/:eventId/check-ins` | `checkin:read` | `CheckInsController.list` |
| check-in | GET | `/workspaces/:slug/events/:eventId/check-ins/summary` | `checkin:read` | `CheckInsController.summary` |
| consent | GET | `/workspaces/:slug/events/:eventId/consent-documents` | `registration:read` | `ConsentController.list` |
| consent | POST | `/workspaces/:slug/events/:eventId/consent-documents` | `registration:manage` | `ConsentController.create` |
| events | GET | `/workspaces/:slug/events` | `event:read` | `EventsController.list` |
| events | POST | `/workspaces/:slug/events` | `event:manage` | `EventsController.create` |
| events | GET | `/workspaces/:slug/events/:eventId` | `event:read` | `EventsController.detail` |
| events | POST | `/workspaces/:slug/events/:eventId/publish` | `event:publish` | `EventsController.publish` |
| events | GET | `/workspaces/:slug/events/:eventId/editions` | `event:read` | `EditionsController.list` |
| events | POST | `/workspaces/:slug/events/:eventId/editions` | `event:manage` | `EditionsController.create` |
| events | GET | `/workspaces/:slug/events/:eventId/editions/:editionId` | `event:read` | `EditionsController.detail` |
| events | GET | `/public/events/:eventSlug/context` | — | `PublicEventsController.context` |
| events | GET | `/public/events/:eventSlug` | — | `PublicEventsController.detail` |
| health | GET | `/health` | — | `HealthController.check` |
| health | GET | `/health/ready` | — | `HealthController.ready` |
| introductions | GET | `/workspaces/:slug/events/:eventId/introductions` | `introduction:read` | `IntroductionsController.list` |
| introductions | POST | `/workspaces/:slug/events/:eventId/introductions` | `introduction:manage` | `IntroductionsController.create` |
| introductions | GET | `/workspaces/:slug/events/:eventId/introductions/:introductionId` | `introduction:read` | `IntroductionsController.detail` |
| introductions | PATCH | `/workspaces/:slug/events/:eventId/introductions/:introductionId` | `introduction:manage` | `IntroductionsController.update` |
| meetings | GET | `/workspaces/:slug/events/:eventId/meetings` | `meeting:read` | `MeetingsController.list` |
| meetings | POST | `/workspaces/:slug/events/:eventId/meetings` | `meeting:manage` | `MeetingsController.propose` |
| meetings | PATCH | `/workspaces/:slug/events/:eventId/meetings/:meetingId` | `meeting:manage` | `MeetingsController.update` |
| memberships | GET | `/workspaces/:slug/members` | `member:read` | `MembershipsController.list` |
| memberships | GET | `/workspaces/:slug/roles` | `member:read` | `MembershipsController.roles` |
| memberships | POST | `/workspaces/:slug/invitations` | `member:manage` | `MembershipsController.invite` |
| memberships | PATCH | `/workspaces/:slug/members/:memberId` | `member:manage` | `MembershipsController.updateRole` |
| memberships | DELETE | `/workspaces/:slug/members/:memberId` | `member:manage` | `MembershipsController.remove` |
| memberships | POST | `/auth/invitations/:token/accept` | — | `InvitationsController.accept` |
| module-registry | GET | `/modules` | — | `ModuleRegistryController.catalogue` |
| module-registry | GET | `/workspaces/:slug/events/:eventId/modules` | `event:read` | `ModuleRegistryController.list` |
| module-registry | PATCH | `/workspaces/:slug/events/:eventId/modules` | `module:manage` | `ModuleRegistryController.update` |
| participants | GET | `/workspaces/:slug/events/:eventId/participants` | `participant:read` | `ParticipantsController.list` |
| participants | GET | `/workspaces/:slug/events/:eventId/participants/:personId` | `participant:read` | `ParticipantsController.detail` |
| profiles | GET | `/workspaces/:slug/events/:eventId/profiles` | `profile:read` | `ParticipantProfilesController.list` |
| profiles | GET | `/workspaces/:slug/events/:eventId/profiles/:profileId` | `profile:read` | `ParticipantProfilesController.detail` |
| profiles | PUT | `/workspaces/:slug/events/:eventId/registrations/:registrationId/profile` | `registration:manage` | `ParticipantProfilesController.upsert` |
| profiles | PATCH | `/workspaces/:slug/events/:eventId/profiles/:profileId` | `registration:manage` | `ParticipantProfilesController.update` |
| profiles | POST | `/workspaces/:slug/events/:eventId/profiles/:profileId/moderate` | `profile:moderate` | `ParticipantProfilesController.moderate` |
| profiles | GET | `/workspaces/:slug/organization-profile` | `profile:read` | `OrganizationProfileController.get` |
| profiles | PUT | `/workspaces/:slug/organization-profile` | `workspace:manage` | `OrganizationProfileController.upsert` |
| profiles | POST | `/workspaces/:slug/organization-profile/moderate` | `profile:moderate` | `OrganizationProfileController.moderate` |
| profiles | GET | `/workspaces/:slug/events/:eventId/showcase` | `profile:read` | `ShowcaseController.list` |
| profiles | POST | `/workspaces/:slug/events/:eventId/showcase` | `registration:manage` | `ShowcaseController.create` |
| profiles | POST | `/workspaces/:slug/events/:eventId/showcase/:innovationId/moderate` | `profile:moderate` | `ShowcaseController.moderate` |
| profiles | GET | `/public/events/:eventSlug/showcase` | — | `PublicShowcaseController.get` |
| registration-forms | GET | `/workspaces/:slug/events/:eventId/categories` | `registration:read` | `CategoriesController.list` |
| registration-forms | POST | `/workspaces/:slug/events/:eventId/categories` | `registration:manage` | `CategoriesController.create` |
| registration-forms | PATCH | `/workspaces/:slug/events/:eventId/categories/:categoryId` | `registration:manage` | `CategoriesController.update` |
| registration-forms | GET | `/workspaces/:slug/events/:eventId/registration-form` | `registration:read` | `RegistrationFormController.show` |
| registration-forms | PUT | `/workspaces/:slug/events/:eventId/registration-form` | `registration:manage` | `RegistrationFormController.save` |
| registration-forms | GET | `/public/events/:eventSlug/registration-form` | — | `PublicRegistrationFormController.show` |
| registrations | GET | `/workspaces/:slug/events/:eventId/registrations` | `registration:read` | `RegistrationsController.list` |
| registrations | GET | `/workspaces/:slug/events/:eventId/registrations/:registrationId` | `registration:read` | `RegistrationsController.detail` |
| registrations | POST | `/workspaces/:slug/events/:eventId/registrations/:registrationId/approve` | `registration:manage` | `RegistrationsController.approve` |
| registrations | POST | `/workspaces/:slug/events/:eventId/registrations/:registrationId/reject` | `registration:manage` | `RegistrationsController.reject` |
| registrations | POST | `/public/events/:eventSlug/registrations` | — | `PublicRegistrationsController.submit` |
| workspaces | GET | `/workspaces/:slug/context` | — | `WorkspacesController.context` |
| workspaces | GET | `/workspaces/:slug/settings` | `workspace:read` | `WorkspacesController.settings` |
| workspaces | PATCH | `/workspaces/:slug/settings` | `workspace:manage` | `WorkspacesController.updateSettings` |
| workspaces | GET | `/workspaces/:slug/branding` | `workspace:read` | `WorkspacesController.branding` |
| workspaces | PATCH | `/workspaces/:slug/branding` | `workspace:manage` | `WorkspacesController.updateBranding` |
| workspaces | POST | `/workspaces/:slug/branding/assets/:kind` | `workspace:manage` | `WorkspacesController.uploadBrandAsset` |
<!-- routes:end -->
