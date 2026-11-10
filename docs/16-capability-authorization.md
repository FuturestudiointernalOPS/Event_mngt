# 16 — Capability authorization

This document defines the application's authorization architecture. It is binding:
`docs/13-coding-rules.md` rule **R12** makes every new feature follow it.

## The model in one paragraph

A **capability** is a named, meaningful application action (`events.publish`,
`registrations.manage_form`, `organization.manage_permissions`). Organisations are
**entitled** to capabilities; members are **granted** capabilities through a role or
directly on their membership. A member can perform an action only when **both** the
organisation entitlement and the member grant are present, and every prerequisite of the
capability is also effective. Anything not explicitly available is denied.

```
Effective access =
  (role capabilities ∪ direct member capabilities)
    ∩ organisation entitlements
    filtered by capability dependencies
```

Resource ownership (event, registration, profile) is a fourth, independent layer: every
query still carries the tenant predicate and returns nothing for another organisation.
The guard answers "may this actor use this capability here"; the service answers "does
this row belong to this tenant".

## The registry

`packages/shared/src/platform/capability-definitions.ts` is the single source of truth.
It is shared by the API, the web app, the seed and the tests. A second list of capability
names must never be created.

Every capability records:

| Field | Meaning |
| --- | --- |
| `key` | Stable dotted identifier, e.g. `registrations.approve` |
| `module` | Owning product module, used for grouping |
| `name`, `description` | Human-readable meaning |
| `scope` | `organization`, `membership`, `both`, `account` or `platform` |
| `requiresOrganizationEntitlement` | Whether the organisation must hold it |
| `sensitive`, `destructive` | Flags for the management UI |
| `dependsOn` | Prerequisites that must also be effective |
| `permissions` | Legacy `resource:action` permissions it replaces (migration only) |
| `status` | `active` or `deprecated` |

Helpers live in `packages/shared/src/platform/capabilities.ts`:
`resolveEffectiveCapabilities`, `capabilitiesForPermissions`,
`permissionsForCapabilities`, `withCapabilityDependencies`,
`capabilitiesByModule`, `missingCapabilityDependencies`.

### Modules and capabilities

The registry currently covers:

- **Organisation** — view/edit workspace, manage branding, view/invite/remove members,
  manage member permissions, view audit log.
- **Events** — view/create/publish events, view/manage modules, view/create editions.
- **Registrations** — view registrations, approve, reject, categories, form, consent,
  badges.
- **Participants** — view participant records.
- **Profiles & showcase** — view, edit, moderate.
- **Check-in** — view, operate.
- **Meetings** — view, manage.
- **Introductions** — view, manage.
- **Reports** — view, export.
- **Account** — create a workspace from a signed-in account that has no organisation yet.
- **Platform** — list, create, suspend, support and manage the entitlements of organisations,
  and view the catalogue.

The exact list is the registry, not this page.

### Account-scoped actions

Registration, email verification and workspace onboarding happen before any organisation
exists. They cannot be expressed as organisation entitlements, so `organization.create`
has scope `account`. It is available to any authenticated, verified account, is not
assignable to an organisation or a membership, and is excluded from entitlement
management. It is the only account-scoped capability today; adding another requires the
same explicit justification.

## Roles are capability templates

The existing `organization_roles` / `permissions` / `role_permissions` tables are retained.
A role is now a reusable, named **collection of capabilities**: its legacy permissions are
mapped to capabilities once, in the shared registry, by
`capabilitiesForPermissions`. This preserves every existing role without a destructive
migration and lets custom roles keep working.

Roles are no longer the only grant mechanism: a member can also receive a capability
directly. The effective set is the union of both, intersected with the entitlement.

## Data model

| Table | Purpose | Isolation |
| --- | --- | --- |
| `organization_capabilities` | Organisation entitlement rows | `organization_id` RLS policy + bootstrap read for the caller's own organisations |
| `member_capabilities` | Direct grants to one membership | `organization_id` RLS policy, `member_id` FK, bootstrap read for the caller's own membership |

Both are in `apps/api/prisma/schema.prisma`, migration
`20261111090000_capabilities`, and policy file `prisma/policies/tenant-rls.sql`.

Important semantics:

- Revoking an organisation entitlement **deletes only the entitlement row**. Direct
  member grants are retained but become ineffective immediately, because every request
  re-evaluates the intersection.
- Revoking a direct grant deletes only that row. A role may still provide it.
- A capability whose dependency is revoked becomes ineffective without deleting its
  assignment. This is deliberate: history is preserved and restoring the prerequisite
  restores the dependent capability.
- Platform administration reads organisation identity and entitlements through the narrow
  `app.platform_admin` session flag. The separate `app.platform_support` flag, used only
  by the support detail view, additionally allows aggregate counts from the team, event
  and registration tables. Neither flag exposes individual tenant rows, and every support
  detail read is audited.

## Request pipeline

```
JwtAuthGuard          verifies the access token, attaches request.user
TenantAccessGuard     resolves the workspace from :slug, verifies membership,
                      loads role + direct grants + organisation entitlements,
                      computes effective capabilities, attaches request.tenant
CapabilityGuard       compares @RequireCapability(...) with request.tenant.capabilities
                      (platform-scoped capabilities check request.user.isPlatformAdmin)
TenantContextInterceptor binds organisation, user, membership and capabilities
```

`CapabilityGuard` is the only route-level authorization gate. A missing membership, an
unknown capability key or an empty effective set fails closed.

The legacy `PermissionsGuard` and `@RequirePermissions` decorator were removed. Legacy
permission strings survive only as the storage format of a role template and as a
derived compatibility set in `TenantAccess.permissions`.

## API surface

Tenant management (`organization.view_members` to read, `organization.manage_permissions`
to change):

| Method | Path | Meaning |
| --- | --- | --- |
| GET | `/workspaces/:slug/me/capabilities` | the caller's effective set and explanation |
| GET | `/workspaces/:slug/capabilities` | organisation entitlements |
| GET | `/workspaces/:slug/members/:memberId/capabilities` | member view with sources |
| PUT | `/workspaces/:slug/members/:memberId/capabilities/:key` | direct grant |
| DELETE | `/workspaces/:slug/members/:memberId/capabilities/:key` | direct revoke |

Platform administration (`platform.organizations.manage`):

| Method | Path | Meaning |
| --- | --- | --- |
| GET | `/platform/capabilities` | the registry, grouped by module |
| GET | `/platform/organizations` | organisations and entitlement counts |
| GET | `/platform/organizations/overview` | paginated organisation portfolio with member, event and registration counts |
| GET | `/platform/organizations/:id` | one organisation's support summary; the read is audited |
| POST | `/platform/organizations` | create a workspace and assign an existing account as its first administrator |
| PATCH | `/platform/organizations/:id/status` | suspend or reactivate an organisation |
| GET | `/platform/organizations/:id/capabilities` | one organisation's entitlements |
| PUT | `/platform/organizations/:id/capabilities/:key` | grant an entitlement |
| DELETE | `/platform/organizations/:id/capabilities/:key` | revoke an entitlement |

Self-service onboarding (`organization.create`, account scope):

| Method | Path | Meaning |
| --- | --- | --- |
| POST | `/onboarding/organizations` | a signed-in account creates a workspace and becomes its first administrator |

Every assignment and revocation appends to `audit_logs` with the actor, organisation,
target, capability and timestamp. Granting a capability automatically stores its
prerequisites too, so a manager cannot create a dormant "publish without view" grant by
accident.

## Screens

- `/workspace/:slug/settings/access` — organisation administrators choose a member, see
  the effective set, distinguish role inheritance from direct grants, and toggle direct
  grants. Capabilities the organisation is not entitled to are shown as unavailable, not
  hidden, so the reason is obvious.
- `/platform` — platform administrators choose an organisation and manage its
  entitlement set, grouped by module.
- Workspace navigation and action controls are derived from the same effective set the
  API uses. Hiding a control is convenience; the API remains authoritative.

## Assigning, revoking and reading access

- **Assign to an organisation:** `PUT /platform/organizations/:id/capabilities/:key`
  (platform administrator). Prerequisites are added automatically.
- **Revoke from an organisation:** `DELETE` on the same path. Every member loses the
  effective capability on their next request; member grant rows remain.
- **Assign to a member:** `PUT /workspaces/:slug/members/:memberId/capabilities/:key`
  (holder of `organization.manage_permissions`). The service refuses a capability the
  organisation does not hold (`capability_not_entitled`).
- **Revoke from a member:** `DELETE` on the same path. Removing the last administrative
  grant is refused (`last_administrator`).
- **Determine effective access:** call the shared
  `resolveEffectiveCapabilities({ organization, role, direct })`, or read
  `request.tenant.capabilities` inside the API, or
  `GET /workspaces/:slug/me/capabilities` from a client. Never hand-roll the rule.

## Migration and compatibility

- Existing organisations receive every organisation-scoped capability in the migration.
  Members remain constrained by the capabilities derived from their current role, so the
  previous access level is preserved. No extra access is granted by the backfill.
- The seed applies the same default set. A newly created organisation copies it
  explicitly, including the six system roles and the first administrator membership.
- Existing permissions and role assignments are untouched.
- Platform administrators can then revoke entitlements deliberately; that is the new
  product control.
- A custom role that has `manage` but not the matching `read` legacy permission may lose
  the dependent capability after migration, because dependencies are enforced. The
  seeded roles all pair read and manage, so no seeded behaviour changes. This is recorded
  here as the one intentional compatibility edge.
- Unknown capability keys in the database are ignored by the evaluator and fail closed in
  the guard.

## Mandatory rule for every future feature (R12)

No new module, action, API endpoint or administrative operation may be merged without:

1. Identifying the owning module.
2. Listing every action a user or organisation can perform.
3. Adding a capability for each meaningful action to
   `packages/shared/src/platform/capability-definitions.ts`.
4. Declaring its scope, entitlement requirement, sensitivity and dependencies.
5. Adding a typed constant to `CAPABILITY_KEYS`.
6. Protecting every tenant route with `@RequireCapability(...)`.
7. Adding the route to the module `routes.ts` catalogue with its capability.
8. Reflecting the capability in navigation, pages and action controls.
9. Adding tests: entitlement + member grant + revocation + cross-tenant refusal.
10. Updating this document when the model or the list of modules changes.

The machine checks that back this up:

- `routes.spec.ts` fails when a protected tenant route has no capability, when the
  catalogue and controller disagree, or when a capability does not exist.
- `capability-registry.spec.ts` fails on duplicate keys, dangling dependencies, drift
  between `CAPABILITY_KEYS` and the registry, or an unmapped legacy permission.
- `policies.spec.ts` fails when a tenant-owned table has no RLS policy.
- `test:isolation` fails when another tenant's capability rows are readable.

A new independent permission mechanism is not acceptable. If the existing capability
model genuinely cannot express the need, change the model in the same commit and record
why.

## Known limitations

- Capability metadata is displayed in English in both locales; it is product
  configuration, not a user-facing translation table yet.
- The platform-admin database scope exposes organisation identity, status and
  entitlements. The separate support scope exposes aggregate counts only; a future
  cross-tenant reporting feature that needs row-level product data must add its own
  explicit policy and audit trail.
- Direct member grants are not versioned rows; the append-only `audit_logs` table is the
  historical record.
- Event-scoped role assignment remains organisation-wide, as recorded in `docs/04`.
- Platform-created organisations require the first administrator to already have an
  account. Self-service onboarding is the path for a person who does not.
