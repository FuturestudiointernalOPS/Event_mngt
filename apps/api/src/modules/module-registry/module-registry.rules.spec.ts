import { describe, expect, it } from 'vitest';
import { AppException } from '../../common/app-exception';
import type { ModuleChange } from './module-registry.rules';
import {
  applyChanges,
  assertCoreNotDisabled,
  assertDependenciesMet,
  assertKnownModules,
  assertKnownSettings,
  assertNoDuplicateChanges,
  assertNoEnabledDependentDisabled,
} from './module-registry.rules';

function capture(fn: () => void): AppException {
  try {
    fn();
  } catch (error) {
    if (error instanceof AppException) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected the call to throw');
}

const change = (key: string, enabled = true): ModuleChange => ({ key, enabled });

describe('applyChanges', () => {
  it('adds enabled modules and removes disabled ones without touching the rest', () => {
    expect(applyChanges(['core', 'reporting'], [change('registration'), change('reporting', false)])).toEqual(
      ['core', 'registration'],
    );
  });

  it('is idempotent for a module that is already in the requested state', () => {
    expect(applyChanges(['core'], [change('core')])).toEqual(['core']);
    expect(applyChanges(['core'], [change('publishing', false)])).toEqual(['core']);
  });
});

describe('assertKnownModules', () => {
  it('accepts registry keys', () => {
    expect(() => assertKnownModules([change('registration')])).not.toThrow();
  });

  it('rejects a key the registry does not define', () => {
    expect(capture(() => assertKnownModules([change('marketplace')])).code).toBe(
      'invalid_module',
    );
  });
});

describe('assertNoDuplicateChanges', () => {
  it('rejects a key repeated in one request', () => {
    expect(
      capture(() => assertNoDuplicateChanges([change('registration'), change('registration', false)]))
        .code,
    ).toBe('invalid_module_change');
  });
});

describe('assertCoreNotDisabled', () => {
  it('allows every other module to be switched off', () => {
    expect(() => assertCoreNotDisabled([change('publishing', false)])).not.toThrow();
  });

  it('refuses to disable core', () => {
    expect(capture(() => assertCoreNotDisabled([change('core', false)])).code).toBe(
      'module_core_required',
    );
  });
});

describe('assertDependenciesMet', () => {
  it('accepts a complete closure', () => {
    expect(() =>
      assertDependenciesMet(['core', 'showcase', 'registration']),
    ).not.toThrow();
  });

  it('names the missing dependencies for a dependent module', () => {
    const error = capture(() => assertDependenciesMet(['core', 'meetings']));

    expect(error.code).toBe('module_dependency_missing');
    expect(error.details).toMatchObject({
      module: 'meetings',
      missing: expect.arrayContaining(['showcase', 'registration']),
    });
  });
});

describe('assertNoEnabledDependentDisabled', () => {
  it('allows disabling a module nothing enabled depends on', () => {
    expect(() =>
      assertNoEnabledDependentDisabled(
        ['core', 'reporting', 'registration'],
        ['core', 'registration'],
      ),
    ).not.toThrow();
  });

  it('refuses to disable a module another enabled module needs', () => {
    const error = capture(() =>
      assertNoEnabledDependentDisabled(
        ['core', 'registration', 'showcase', 'meetings'],
        ['core', 'registration', 'meetings'],
      ),
    );

    expect(error.code).toBe('module_required_by_other');
    expect(error.details).toMatchObject({ module: 'showcase', dependents: ['meetings'] });
  });
});

describe('assertKnownSettings', () => {
  it('accepts the keys the registry defines', () => {
    expect(() =>
      assertKnownSettings('registration', {
        approvalMode: 'automatic',
        requiresConsent: false,
        duplicatePolicy: 'block',
      }),
    ).not.toThrow();
  });

  it('refuses an unknown key instead of letting Zod strip it', () => {
    const error = capture(() => assertKnownSettings('registration', { approvalMode: 'automatic', nope: true }));

    expect(error.code).toBe('invalid_module_settings');
    expect(error.details).toEqual([{ path: 'nope', message: 'Unknown setting' }]);
  });

  it('accepts no settings for a module that defines none', () => {
    expect(() => assertKnownSettings('reporting', {})).not.toThrow();
    expect(capture(() => assertKnownSettings('reporting', { nope: 1 })).code).toBe(
      'invalid_module_settings',
    );
  });
});
