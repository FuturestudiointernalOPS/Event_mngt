# WP-05 — Event module registry

**Wave** 1 · **Parallel-safe** yes
**Owns** `apps/api/src/modules/module-registry/**`
**Depends on** WP-01

## Goal

An event can enable, configure and disable product modules, and an invalid combination is
refused with a code that explains why.

## Contract

| Route | Permission | Behaviour |
| --- | --- | --- |
| `GET /modules` | signed-in | the catalogue: key, name, description, dependencies |
| `GET /workspaces/:slug/events/:eventId/modules` | `event:read` | modules for one event |
| `PATCH /workspaces/:slug/events/:eventId/modules` | `module:manage` | enable/disable a set |

The catalogue and the dependency rules already exist in the shared package
(`packages/shared/src/platform/module-registry.ts`). Reuse them; do not duplicate the
catalogue in the API.

## Rules

- Enabling a module whose dependencies are not enabled is refused with
  `module_dependency_missing`, naming the missing keys.
- Disabling a module that another enabled module depends on is refused with
  `module_required_by_other`.
- Disabling never deletes the row; it flips `enabled`. History and settings survive.
- `core` can never be disabled.
- Settings are validated before storage; an unknown key for the module is refused.
- Every write goes through the tenant transaction with an explicit organisation predicate.

## Acceptance (each becomes a test)

1. Enabling a dependent module alone is refused and names the requirement.
2. Enabling the requirement first, then the dependent module, succeeds.
3. Disabling a required module is refused while a dependent one is enabled.
4. Disabling then re-enabling keeps the previous settings.
5. `core` cannot be disabled.
6. Another tenant's event id yields not found, not a permissions error.

## Integration requests to the pre-flight

- Register `ModuleRegistryModule` in the composition root.
- Nothing to the schema: `event_modules` exists and is policy-protected.

## Out of scope

Per-module feature implementation (that is the module's own package) and pricing/entitlements.
