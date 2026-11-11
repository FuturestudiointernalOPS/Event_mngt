import { describe, expect, it } from 'vitest';
import { RegistrationStatus } from '../../database/prisma-client';
import { input, field, createSubmissionHarness, TARGET } from '../../../test/support/registration-submission.harness';

describe('registration submission', () => {
  it('stores the registration, its answers and its consents under the event organisation', async () => {
    const { service, created, acceptances } = createSubmissionHarness({
      existingPerson: { ...person(), email: 'amina@example.test' },
    });

    const receipt = await service.submit('village-2026', input(), '203.0.113.9');

    expect(receipt.reference).toBe(created[0].reference);
    expect(receipt.status).toBe('PENDING');
    expect(receipt.requiresApproval).toBe(true);
    expect(receipt.badgeIssued).toBe(false);
    expect(created[0]).toMatchObject({
      organizationId: 'org-1',
      eventId: 'event-1',
      personId: 'person-1',
      status: RegistrationStatus.PENDING,
    });
    expect(created[0].answers).toEqual([
      { fieldId: 'field-1', fieldKey: 'motivation', value: 'Because' },
    ]);
    expect(acceptances[0]).toMatchObject({
      organizationId: 'org-1',
      registrationId: 'registration-1',
      ipAddress: '203.0.113.9',
    });
  });

  it('refuses a registration into a full category and stores nothing', async () => {
    // Regression: capacity was stored but never enforced, so a category could be oversold.
    const { service, created } = createSubmissionHarness({
      existingPerson: person(),
      seatAvailable: false,
    });

    await expect(
      service.submit('village-2026', input({ categoryKey: 'visitor' }), null),
    ).rejects.toMatchObject({ code: 'category_full' });
    expect(created).toHaveLength(0);
  });

  it('reuses the person row for the same email in the same organisation', async () => {
    const { service, counters } = createSubmissionHarness({
      existingPerson: person(),
    });

    await service.submit('village-2026', input(), null);

    expect(counters.personCreates).toBe(0);
  });

  it('creates a person when the email is new to this organisation', async () => {
    const { service, counters } = createSubmissionHarness({ existingPerson: null });

    await service.submit('village-2026', input(), null);

    expect(counters.personCreates).toBe(1);
  });

  it('approves immediately and issues a badge in automatic mode', async () => {
    const { service, created, counters } = createSubmissionHarness({
      existingPerson: person(),
      settings: { approvalMode: 'automatic', duplicatePolicy: 'warn' },
    });

    const receipt = await service.submit('village-2026', input(), null);

    expect(created[0].status).toBe(RegistrationStatus.APPROVED);
    expect(receipt.requiresApproval).toBe(false);
    expect(receipt.badgeIssued).toBe(true);
    expect(counters.issueCalls).toBe(1);
    expect(counters.notifications).toBe(1);
  });

  it('refuses a closed window', async () => {
    const { service } = createSubmissionHarness({
      existingPerson: person(),
      target: {
        ...TARGET,
        registrationClosesAt: new Date('2026-11-09T00:00:00.000Z'),
      },
    });

    await expect(service.submit('village-2026', input(), null)).rejects.toMatchObject({
      code: 'registration_closed',
    });
  });

  it('refuses an invalid answer set before writing anything', async () => {
    const { service, created } = createSubmissionHarness({
      existingPerson: person(),
      fields: [field({ required: true })],
    });

    await expect(
      service.submit('village-2026', input({ answers: [] }), null),
    ).rejects.toMatchObject({ code: 'validation_error' });

    expect(created).toEqual([]);
  });

  it('refuses a duplicate when the policy is block', async () => {
    const { service, created } = createSubmissionHarness({
      existingPerson: person(),
      duplicate: { id: 'registration-0', reference: 'EP-ZZZZZZ' },
      settings: { approvalMode: 'manual', duplicatePolicy: 'block' },
    });

    await expect(service.submit('village-2026', input(), null)).rejects.toMatchObject({
      code: 'duplicate_registration',
    });

    expect(created).toEqual([]);
  });

  it('accepts a duplicate with a warning when the policy is warn', async () => {
    const { service } = createSubmissionHarness({
      existingPerson: person(),
      duplicate: { id: 'registration-0', reference: 'EP-ZZZZZZ' },
      settings: { approvalMode: 'manual', duplicatePolicy: 'warn' },
    });

    const receipt = await service.submit('village-2026', input(), null);

    expect(receipt.duplicate).toBe(true);
  });

  it('does not store a blank optional answer', async () => {
    const { service, created } = createSubmissionHarness({
      existingPerson: person(),
      fields: [field({ required: false, key: 'comments' })],
    });

    await service.submit(
      'village-2026',
      input({ answers: [{ fieldKey: 'comments', value: '   ' }] }),
      null,
    );

    expect(created[0].answers).toEqual([]);
  });

  it('refuses a category that is not available', async () => {
    const { service } = createSubmissionHarness({
      existingPerson: person(),
      categoryAvailable: false,
    });

    await expect(
      service.submit('village-2026', input({ categoryKey: 'startup' }), null),
    ).rejects.toMatchObject({ code: 'invalid_category' });
  });

  it('reports an unknown event slug as not found', async () => {
    const { service } = createSubmissionHarness({ target: null });

    await expect(service.submit('missing', input(), null)).rejects.toMatchObject({
      code: 'not_found',
    });
  });
});

function person() {
  return {
    id: 'person-1',
    organizationId: 'org-1',
    email: 'amina@example.test',
    firstName: 'Amina',
    lastName: 'Dossou',
    phone: null,
    organizationName: null,
    jobTitle: null,
    country: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
