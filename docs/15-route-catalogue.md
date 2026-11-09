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
| memberships | GET | `/workspaces/:slug/members` | `member:read` | `MembershipsController.list` |
| memberships | GET | `/workspaces/:slug/roles` | `member:read` | `MembershipsController.roles` |
| memberships | POST | `/workspaces/:slug/invitations` | `member:manage` | `MembershipsController.invite` |
| memberships | PATCH | `/workspaces/:slug/members/:memberId` | `member:manage` | `MembershipsController.updateRole` |
| memberships | DELETE | `/workspaces/:slug/members/:memberId` | `member:manage` | `MembershipsController.remove` |
| memberships | POST | `/auth/invitations/:token/accept` | — | `InvitationsController.accept` |
| module-registry | GET | `/modules` | — | `ModuleRegistryController.catalogue` |
| module-registry | GET | `/workspaces/:slug/events/:eventId/modules` | `event:read` | `ModuleRegistryController.list` |
| module-registry | PATCH | `/workspaces/:slug/events/:eventId/modules` | `module:manage` | `ModuleRegistryController.update` |
| workspaces | GET | `/workspaces/:slug/context` | — | `WorkspacesController.context` |
| workspaces | GET | `/workspaces/:slug/settings` | `workspace:read` | `WorkspacesController.settings` |
| workspaces | PATCH | `/workspaces/:slug/settings` | `workspace:manage` | `WorkspacesController.updateSettings` |
| workspaces | GET | `/workspaces/:slug/branding` | `workspace:read` | `WorkspacesController.branding` |
| workspaces | PATCH | `/workspaces/:slug/branding` | `workspace:manage` | `WorkspacesController.updateBranding` |
| workspaces | POST | `/workspaces/:slug/branding/assets/:kind` | `workspace:manage` | `WorkspacesController.uploadBrandAsset` |
<!-- routes:end -->
