import {
  getModuleDefinition,
  missingDependencies,
  resolveDependencies,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';

/**
 * Module activation rules, as pure functions (R11).
 *
 * The catalogue, priorities and dependency graph already live in the shared package.
 * This file only decides whether a requested set of changes is legal; the service
 * persists the result.
 */

export interface ModuleChange {
  key: string;
  enabled: boolean;
}

export function assertKnownModules(changes: readonly ModuleChange[]): void {
  for (const change of changes) {
    if (!getModuleDefinition(change.key)) {
      throw AppException.unprocessable(
        'invalid_module',
        `Unknown module "${change.key}".`,
      );
    }
  }
}

export function assertNoDuplicateChanges(changes: readonly ModuleChange[]): void {
  const seen = new Set<string>();

  for (const change of changes) {
    if (seen.has(change.key)) {
      throw AppException.badRequest(
        'invalid_module_change',
        `Module "${change.key}" appears more than once.`,
      );
    }
    seen.add(change.key);
  }
}

/** The enabled set after applying the requested changes. */
export function applyChanges(
  currentEnabled: readonly string[],
  changes: readonly ModuleChange[],
): string[] {
  const next = new Set(currentEnabled);

  for (const change of changes) {
    if (change.enabled) {
      next.add(change.key);
    } else {
      next.delete(change.key);
    }
  }

  return [...next].sort();
}

/** `core` is the event itself; it is never something a caller can switch off. */
export function assertCoreNotDisabled(changes: readonly ModuleChange[]): void {
  if (changes.some((change) => change.key === 'core' && !change.enabled)) {
    throw AppException.unprocessable(
      'module_core_required',
      'The core module cannot be disabled.',
    );
  }
}

/** Every enabled module must have its full dependency closure enabled too. */
export function assertDependenciesMet(enabled: readonly string[]): void {
  for (const key of enabled) {
    const missing = missingDependencies(key, enabled);

    if (missing.length > 0) {
      throw AppException.unprocessable(
        'module_dependency_missing',
        `The "${key}" module needs ${missing.join(', ')} enabled first.`,
        { module: key, missing },
      );
    }
  }
}

/** A module cannot be switched off while another enabled module depends on it. */
export function assertNoEnabledDependentDisabled(
  currentEnabled: readonly string[],
  nextEnabled: readonly string[],
): void {
  const next = new Set(nextEnabled);

  for (const key of currentEnabled) {
    if (next.has(key)) {
      continue;
    }

    const dependents = nextEnabled.filter((other) =>
      resolveDependencies(other).includes(key),
    );

    if (dependents.length > 0) {
      throw AppException.unprocessable(
        'module_required_by_other',
        `The "${key}" module is required by ${dependents.join(', ')}.`,
        { module: key, dependents },
      );
    }
  }
}

/**
 * Settings are an allowlist too. The registry's `defaults` object names every key its
 * schema defines, so an unknown key is refused rather than silently stripped by Zod.
 */
export function assertKnownSettings(
  key: string,
  settings: Record<string, unknown>,
): void {
  const definition = getModuleDefinition(key);

  if (!definition) {
    return;
  }

  const allowed = new Set(Object.keys(definition.defaults));
  const unknown = Object.keys(settings).filter((setting) => !allowed.has(setting));

  if (unknown.length > 0) {
    throw AppException.unprocessable(
      'invalid_module_settings',
      `The settings for "${key}" contain unknown keys.`,
      unknown.map((setting) => ({ path: setting, message: 'Unknown setting' })),
    );
  }
}
