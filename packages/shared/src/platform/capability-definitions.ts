import type { CapabilityDefinition } from './capabilities';
import { ORGANIZATION_EVENT_CAPABILITIES } from './capability-definitions.organization-events';
import { REGISTRATION_PROFILE_CAPABILITIES } from './capability-definitions.registrations-profiles';
import { OPERATIONS_REPORTING_CAPABILITIES } from './capability-definitions.operations';

/**
 * The capability registry — the single source of truth for what the application can
 * authorise.
 *
 * A capability is a meaningful user-facing action, not a CRUD verb. Each entry records
 * which module owns it, whether an organisation must be entitled to it, whether it is
 * sensitive or destructive, what it depends on, and which legacy `resource:action`
 * permission it replaced. The legacy permission field exists only to derive role
 * templates during the transition; authorization itself is capability-based.
 *
 * Entries are grouped by product area to keep each file readable. Adding a feature means
 * adding its capabilities here first. See docs/16-capability-authorization.md.
 */
export const CAPABILITY_DEFINITIONS: CapabilityDefinition[] = [
  ...ORGANIZATION_EVENT_CAPABILITIES,
  ...REGISTRATION_PROFILE_CAPABILITIES,
  ...OPERATIONS_REPORTING_CAPABILITIES,
];
