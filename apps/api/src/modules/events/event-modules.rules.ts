import {
  MODULE_REGISTRY,
  getModuleDefinition,
  missingDependencies,
  validateModuleSettings,
  type ModuleDefinition,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';

/** Module activation rules, pure so they can be tested without a database (R11). */

const ALWAYS_ON = ['core'];

/** P1 and P2 modules are catalogued but not buildable until the P0 beta is validated. */
export function isModuleAvailable(definition: ModuleDefinition): boolean {
  return definition.priority === 'core' || definition.priority === 'p0';
}

export function dependentsOf(key: string, enabled: readonly string[]): string[] {
  return MODULE_REGISTRY.filter(
    (module) => enabled.includes(module.key) && module.dependsOn.includes(key),
  ).map((module) => module.key);
}

/**
 * Validates a request to enable or disable a module and returns the settings to store
 * (defaults merged with the validated input) when enabling.
 */
export function planModuleChange(input: {
  key: string;
  enable: boolean;
  enabledKeys: readonly string[];
  settings?: Record<string, unknown>;
  /** Modules the platform administrator has switched off for every organisation. */
  platformDisabled?: readonly string[];
}): { settings: Record<string, unknown> } {
  const definition = getModuleDefinition(input.key);

  if (!definition) {
    throw AppException.notFound('module_not_found', 'This module does not exist.');
  }

  if (!input.enable) {
    if (ALWAYS_ON.includes(input.key)) {
      throw AppException.unprocessable('module_required', 'The event core cannot be disabled.');
    }

    const dependents = dependentsOf(input.key, input.enabledKeys);
    if (dependents.length > 0) {
      throw AppException.unprocessable(
        'module_in_use',
        'Disable the modules that depend on this one first.',
        { dependents },
      );
    }

    return { settings: {} };
  }

  if (!isModuleAvailable(definition) || input.platformDisabled?.includes(input.key)) {
    throw AppException.unprocessable(
      'module_unavailable',
      'This module is not available yet.',
    );
  }

  const missing = missingDependencies(input.key, input.enabledKeys);
  if (missing.length > 0) {
    throw AppException.unprocessable(
      'module_dependency_missing',
      'Enable the modules this one depends on first.',
      { missing },
    );
  }

  const validated = validateModuleSettings(input.key, {
    ...definition.defaults,
    ...(input.settings ?? {}),
  });

  if (!validated.success) {
    throw AppException.badRequest('invalid_module_settings', 'The module settings are invalid.', {
      issues: validated.issues,
    });
  }

  return { settings: validated.data };
}
