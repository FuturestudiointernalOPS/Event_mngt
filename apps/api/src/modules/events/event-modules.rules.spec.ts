import { describe, expect, it } from 'vitest';
import { AppException } from '../../common/app-exception';
import { dependentsOf, planModuleChange } from './event-modules.rules';

function failure(fn: () => unknown): AppException {
  try {
    fn();
  } catch (error) {
    if (error instanceof AppException) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected a failure');
}

describe('planModuleChange', () => {
  it('rejects enabling a module whose dependency is off and lists what is missing', () => {
    const error = failure(() =>
      planModuleChange({ key: 'showcase', enable: true, enabledKeys: ['core'] }),
    );

    expect(error.code).toBe('module_dependency_missing');
    expect(error.details).toEqual({ missing: ['registration'] });
  });

  it('enables a module once its dependencies are on, merging defaults', () => {
    const plan = planModuleChange({
      key: 'registration',
      enable: true,
      enabledKeys: ['core'],
      settings: { approvalMode: 'automatic' },
    });

    expect(plan.settings).toMatchObject({ approvalMode: 'automatic', requiresConsent: true });
  });

  it('rejects invalid settings with the offending path', () => {
    const error = failure(() =>
      planModuleChange({
        key: 'checkin',
        enable: true,
        enabledKeys: ['core', 'registration'],
        settings: { duplicateWindowMinutes: 9999 },
      }),
    );

    expect(error.code).toBe('invalid_module_settings');
  });

  it('refuses to disable a module another enabled module needs', () => {
    const error = failure(() =>
      planModuleChange({
        key: 'registration',
        enable: false,
        enabledKeys: ['core', 'registration', 'checkin'],
      }),
    );

    expect(error.code).toBe('module_in_use');
    expect(error.details).toEqual({ dependents: ['checkin'] });
  });

  it('never disables the event core', () => {
    expect(
      failure(() => planModuleChange({ key: 'core', enable: false, enabledKeys: ['core'] })).code,
    ).toBe('module_required');
  });

  it('does not enable later-phase modules', () => {
    expect(
      failure(() => planModuleChange({ key: 'agenda', enable: true, enabledKeys: ['core'] })).code,
    ).toBe('module_unavailable');
  });

  it('rejects an unknown module', () => {
    expect(
      failure(() => planModuleChange({ key: 'nope', enable: true, enabledKeys: [] })).code,
    ).toBe('module_not_found');
  });
});

describe('platform availability', () => {
  it('refuses to enable a module the platform has switched off', () => {
    const error = failure(() =>
      planModuleChange({ key: 'checkin', enable: true, enabledKeys: ['core', 'registration'], platformDisabled: ['checkin'] }),
    );

    expect(error.code).toBe('module_unavailable');
  });

  it('still lets an organisation disable a module that was switched off afterwards', () => {
    expect(() =>
      planModuleChange({ key: 'checkin', enable: false, enabledKeys: ['core', 'registration', 'checkin'], platformDisabled: ['checkin'] }),
    ).not.toThrow();
  });
});

describe('dependentsOf', () => {
  it('lists only enabled modules that depend on the key', () => {
    expect(dependentsOf('registration', ['core', 'showcase', 'agenda'])).toEqual(['showcase']);
  });
});
