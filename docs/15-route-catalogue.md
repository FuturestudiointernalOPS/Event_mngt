# 15 — Route catalogue

Every feature module has a `routes.ts` beside its controllers. It lists each route's
method, path, required capability and controller method, grouped by module. The
controllers remain the handlers.

The catalogue is not decorative. `apps/api/src/common/routes/routes.spec.ts` reads the
route metadata Nest stores on the real controllers and compares it with these files. A
route added without an entry, an entry left behind by a removed controller, or a changed
capability fails the test. It also fails when a protected tenant route has no capability
at all, or when a capability does not exist in the shared registry. The same spec compares
the table below with the catalogues, so the documentation cannot silently drift either.

Paths are relative to `/api/v1`. `—` means the route is public or only needs a session.
Capability keys are defined in `packages/shared/src/platform/capability-definitions.ts`;
see `docs/16-capability-authorization.md`.

<!-- routes:start -->
| Module | Method | Path | Capability | Handler |
| --- | --- | --- | --- | --- |
| analytics | GET | `/public/events/:eventSlug/metrics` | — | `PublicMetricsController.get` |
| audit | GET | `/workspaces/:slug/audit` | `organization.view_audit_log` | `AuditController.list` |
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
| auth | GET | `/auth/mfa` | — | `MfaController.status` |
| auth | POST | `/auth/mfa/setup` | — | `MfaController.setup` |
| auth | POST | `/auth/mfa/enable` | — | `MfaController.enable` |
| auth | POST | `/auth/mfa/disable` | — | `MfaController.disable` |
| badges | GET | `/workspaces/:slug/events/:eventId/badges` | `registrations.view_badges` | `BadgesController.list` |
| badges | GET | `/workspaces/:slug/events/:eventId/registrations/:registrationId/badge` | `registrations.view_badges` | `BadgesController.detail` |
| badges | POST | `/workspaces/:slug/events/:eventId/registrations/:registrationId/badge/reissue` | `registrations.manage_badges` | `BadgesController.reissue` |
| badges | POST | `/workspaces/:slug/events/:eventId/registrations/:registrationId/badge/revoke` | `registrations.manage_badges` | `BadgesController.revoke` |
| capabilities | GET | `/workspaces/:slug/me/capabilities` | — | `CapabilitiesController.self` |
| capabilities | GET | `/workspaces/:slug/capabilities` | `organization.view_members` | `CapabilitiesController.organization` |
| capabilities | GET | `/workspaces/:slug/members/:memberId/capabilities` | `organization.view_members` | `CapabilitiesController.member` |
| capabilities | PUT | `/workspaces/:slug/members/:memberId/capabilities/:capabilityKey` | `organization.manage_permissions` | `CapabilitiesController.grant` |
| capabilities | DELETE | `/workspaces/:slug/members/:memberId/capabilities/:capabilityKey` | `organization.manage_permissions` | `CapabilitiesController.revoke` |
| capabilities | GET | `/platform/capabilities` | `platform.capabilities.view` | `PlatformCapabilitiesController.catalogue` |
| capabilities | GET | `/platform/organizations` | `platform.organizations.manage` | `PlatformCapabilitiesController.organizations` |
| capabilities | GET | `/platform/organizations/:organizationId/capabilities` | `platform.organizations.manage` | `PlatformCapabilitiesController.organization` |
| capabilities | PUT | `/platform/organizations/:organizationId/capabilities/:capabilityKey` | `platform.organizations.manage` | `PlatformCapabilitiesController.grant` |
| capabilities | DELETE | `/platform/organizations/:organizationId/capabilities/:capabilityKey` | `platform.organizations.manage` | `PlatformCapabilitiesController.revoke` |
| check-in | POST | `/workspaces/:slug/events/:eventId/check-ins` | `check_in.operate` | `CheckInsController.record` |
| check-in | POST | `/workspaces/:slug/events/:eventId/check-ins/sync` | `check_in.operate` | `CheckInsController.sync` |
| check-in | GET | `/workspaces/:slug/events/:eventId/check-ins` | `check_in.view` | `CheckInsController.list` |
| check-in | GET | `/workspaces/:slug/events/:eventId/check-ins/summary` | `check_in.view` | `CheckInsController.summary` |
| consent | GET | `/workspaces/:slug/events/:eventId/consent-documents` | `registrations.view_consent` | `ConsentController.list` |
| consent | POST | `/workspaces/:slug/events/:eventId/consent-documents` | `registrations.manage_consent` | `ConsentController.create` |
| events | GET | `/workspaces/:slug/events` | `events.view` | `EventsController.list` |
| events | POST | `/workspaces/:slug/events` | `events.create` | `EventsController.create` |
| events | GET | `/workspaces/:slug/events/:eventId` | `events.view` | `EventsController.detail` |
| events | POST | `/workspaces/:slug/events/:eventId/publish` | `events.publish` | `EventsController.publish` |
| events | POST | `/workspaces/:slug/events/:eventId/banner` | `events.create` | `EventsController.uploadBanner` |
| events | PATCH | `/workspaces/:slug/events/:eventId` | `events.create` | `EventsController.update` |
| events | POST | `/workspaces/:slug/events/:eventId/transitions` | `events.publish` | `EventsController.transition` |
| events | POST | `/workspaces/:slug/events/:eventId/duplicate` | `events.create` | `EventsController.duplicate` |
| events | GET | `/workspaces/:slug/events/:eventId/editions` | `editions.view` | `EditionsController.list` |
| events | POST | `/workspaces/:slug/events/:eventId/editions` | `editions.create` | `EditionsController.create` |
| events | GET | `/workspaces/:slug/events/:eventId/editions/:editionId` | `editions.view` | `EditionsController.detail` |
| events | GET | `/public/events/:eventSlug/context` | — | `PublicEventsController.context` |
| events | GET | `/public/events/:eventSlug` | — | `PublicEventsController.detail` |
| health | GET | `/health` | — | `HealthController.check` |
| health | GET | `/health/ready` | — | `HealthController.ready` |
| introductions | GET | `/workspaces/:slug/events/:eventId/introductions` | `introductions.view` | `IntroductionsController.list` |
| introductions | POST | `/workspaces/:slug/events/:eventId/introductions` | `introductions.manage` | `IntroductionsController.create` |
| introductions | GET | `/workspaces/:slug/events/:eventId/introductions/:introductionId` | `introductions.view` | `IntroductionsController.detail` |
| introductions | PATCH | `/workspaces/:slug/events/:eventId/introductions/:introductionId` | `introductions.manage` | `IntroductionsController.update` |
| meetings | GET | `/workspaces/:slug/events/:eventId/meetings` | `meetings.view` | `MeetingsController.list` |
| meetings | POST | `/workspaces/:slug/events/:eventId/meetings` | `meetings.manage` | `MeetingsController.propose` |
| meetings | PATCH | `/workspaces/:slug/events/:eventId/meetings/:meetingId` | `meetings.manage` | `MeetingsController.update` |
| memberships | GET | `/workspaces/:slug/members` | `organization.view_members` | `MembershipsController.list` |
| memberships | GET | `/workspaces/:slug/roles` | `organization.view_members` | `MembershipsController.roles` |
| memberships | GET | `/workspaces/:slug/invitations` | `organization.view_members` | `MembershipsController.listInvitations` |
| memberships | POST | `/workspaces/:slug/invitations` | `organization.invite_members` | `MembershipsController.invite` |
| memberships | DELETE | `/workspaces/:slug/invitations/:invitationId` | `organization.invite_members` | `MembershipsController.revokeInvitation` |
| memberships | PATCH | `/workspaces/:slug/members/:memberId` | `organization.manage_permissions` | `MembershipsController.updateMember` |
| memberships | DELETE | `/workspaces/:slug/members/:memberId` | `organization.remove_members` | `MembershipsController.remove` |
| memberships | POST | `/auth/invitations/:token/accept` | — | `InvitationsController.accept` |
| module-registry | GET | `/modules` | — | `ModuleRegistryController.catalogue` |
| module-registry | GET | `/workspaces/:slug/events/:eventId/modules` | `events.view_modules` | `ModuleRegistryController.list` |
| module-registry | PATCH | `/workspaces/:slug/events/:eventId/modules` | `events.manage_modules` | `ModuleRegistryController.update` |
| organizations | POST | `/onboarding/organizations` | `organization.create` | `OrganizationsController.create` |
| participant-portal | GET | `/participant/me` | — | `ParticipantPortalController.me` |
| participant-portal | GET | `/participant/export` | — | `ParticipantPortalController.exportData` |
| participant-portal | POST | `/participant/withdraw` | — | `ParticipantPortalController.withdraw` |
| participant-portal | POST | `/participant/erase` | — | `ParticipantPortalController.erase` |
| participant-portal | GET | `/participant/profile` | — | `ParticipantPortalController.profile` |
| participant-portal | PUT | `/participant/profile` | — | `ParticipantPortalController.saveProfile` |
| participant-portal | GET | `/participant/directory` | — | `ParticipantPortalController.directory` |
| participant-portal | GET | `/participant/meetings` | — | `ParticipantPortalController.meetings` |
| participant-portal | POST | `/participant/meetings` | — | `ParticipantPortalController.proposeMeeting` |
| participant-portal | POST | `/participant/meetings/:meetingId/respond` | — | `ParticipantPortalController.respondToMeeting` |
| participant-portal | GET | `/participant/introductions` | — | `ParticipantPortalController.introductions` |
| participant-portal | POST | `/participant/introductions` | — | `ParticipantPortalController.requestIntroduction` |
| participants | GET | `/workspaces/:slug/events/:eventId/participants` | `participants.view` | `ParticipantsController.list` |
| participants | GET | `/workspaces/:slug/events/:eventId/participants/:personId` | `participants.view` | `ParticipantsController.detail` |
| platform | GET | `/platform/organizations/overview` | `platform.organizations.manage` | `PlatformOrganizationsController.overview` |
| platform | GET | `/platform/organizations/:organizationId` | `platform.organizations.manage` | `PlatformOrganizationsController.detail` |
| platform | POST | `/platform/organizations` | `platform.organizations.manage` | `PlatformOrganizationsController.create` |
| platform | PATCH | `/platform/organizations/:organizationId/status` | `platform.organizations.manage` | `PlatformOrganizationsController.updateStatus` |
| profiles | GET | `/workspaces/:slug/events/:eventId/profiles` | `profiles.view` | `ParticipantProfilesController.list` |
| profiles | GET | `/workspaces/:slug/events/:eventId/profiles/:profileId` | `profiles.view` | `ParticipantProfilesController.detail` |
| profiles | PUT | `/workspaces/:slug/events/:eventId/registrations/:registrationId/profile` | `profiles.edit` | `ParticipantProfilesController.upsert` |
| profiles | PATCH | `/workspaces/:slug/events/:eventId/profiles/:profileId` | `profiles.edit` | `ParticipantProfilesController.update` |
| profiles | POST | `/workspaces/:slug/events/:eventId/profiles/:profileId/moderate` | `profiles.moderate` | `ParticipantProfilesController.moderate` |
| profiles | GET | `/workspaces/:slug/organization-profile` | `profiles.view` | `OrganizationProfileController.get` |
| profiles | PUT | `/workspaces/:slug/organization-profile` | `organization.edit` | `OrganizationProfileController.upsert` |
| profiles | POST | `/workspaces/:slug/organization-profile/moderate` | `profiles.moderate` | `OrganizationProfileController.moderate` |
| profiles | GET | `/workspaces/:slug/events/:eventId/showcase` | `profiles.view` | `ShowcaseController.list` |
| profiles | POST | `/workspaces/:slug/events/:eventId/showcase` | `profiles.edit` | `ShowcaseController.create` |
| profiles | POST | `/workspaces/:slug/events/:eventId/showcase/:innovationId/moderate` | `profiles.moderate` | `ShowcaseController.moderate` |
| profiles | GET | `/public/events/:eventSlug/showcase` | — | `PublicShowcaseController.get` |
| registration-forms | GET | `/workspaces/:slug/events/:eventId/categories` | `registrations.view_categories` | `CategoriesController.list` |
| registration-forms | POST | `/workspaces/:slug/events/:eventId/categories` | `registrations.manage_categories` | `CategoriesController.create` |
| registration-forms | PATCH | `/workspaces/:slug/events/:eventId/categories/:categoryId` | `registrations.manage_categories` | `CategoriesController.update` |
| registration-forms | GET | `/workspaces/:slug/events/:eventId/registration-form` | `registrations.view_form` | `RegistrationFormController.show` |
| registration-forms | PUT | `/workspaces/:slug/events/:eventId/registration-form` | `registrations.manage_form` | `RegistrationFormController.save` |
| registration-forms | GET | `/public/events/:eventSlug/registration-form` | — | `PublicRegistrationFormController.show` |
| registrations | GET | `/workspaces/:slug/events/:eventId/registrations` | `registrations.view` | `RegistrationsController.list` |
| registrations | GET | `/workspaces/:slug/events/:eventId/registrations/:registrationId` | `registrations.view` | `RegistrationsController.detail` |
| registrations | POST | `/workspaces/:slug/events/:eventId/registrations/:registrationId/approve` | `registrations.approve` | `RegistrationsController.approve` |
| registrations | POST | `/workspaces/:slug/events/:eventId/registrations/:registrationId/reject` | `registrations.reject` | `RegistrationsController.reject` |
| registrations | POST | `/workspaces/:slug/events/:eventId/registrations/:registrationId/erase` | `registrations.erase` | `RegistrationsController.erase` |
| registrations | POST | `/workspaces/:slug/retention/purge` | `registrations.erase` | `RegistrationsRetentionController.purge` |
| registrations | POST | `/public/events/:eventSlug/registrations` | — | `PublicRegistrationsController.submit` |
| reports | GET | `/workspaces/:slug/events/:eventId/reports/summary` | `reports.view` | `ReportsController.eventSummary` |
| reports | GET | `/workspaces/:slug/reports/summary` | `reports.view` | `ReportsController.organizationSummary` |
| reports | GET | `/workspaces/:slug/events/:eventId/reports/editions` | `reports.view` | `ReportsController.editions` |
| reports | POST | `/workspaces/:slug/events/:eventId/exports` | `reports.export` | `ExportsController.create` |
| reports | GET | `/workspaces/:slug/events/:eventId/exports` | `reports.view` | `ExportsController.list` |
| reports | GET | `/workspaces/:slug/exports/:exportId` | `reports.view` | `ExportsController.detail` |
| reports | GET | `/workspaces/:slug/exports/:exportId/download` | `reports.export` | `ExportsController.download` |
| workspaces | GET | `/workspaces/:slug/context` | — | `WorkspacesController.context` |
| workspaces | GET | `/workspaces/:slug/settings` | `organization.view` | `WorkspacesController.settings` |
| workspaces | PATCH | `/workspaces/:slug/settings` | `organization.edit` | `WorkspacesController.updateSettings` |
| workspaces | GET | `/workspaces/:slug/branding` | `organization.view` | `WorkspacesController.branding` |
| workspaces | PATCH | `/workspaces/:slug/branding` | `organization.manage_branding` | `WorkspacesController.updateBranding` |
| workspaces | POST | `/workspaces/:slug/branding/assets/:kind` | `organization.manage_branding` | `WorkspacesController.uploadBrandAsset` |
<!-- routes:end -->
