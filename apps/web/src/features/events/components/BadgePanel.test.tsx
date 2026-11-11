import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/app/providers/I18nProvider';
import { ApiRequestError } from '@/services/api-client';
import { eventAdminApi } from '@/services/event-admin.api';
import { BadgePanel } from './BadgePanel';

vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,AAAA') } }));

function renderPanel(canManage: boolean): void {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <BadgePanel slug="acme" eventId="e1" registrationId="r1" canManage={canManage} />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('BadgePanel', () => {
  it('explains when no badge exists and lets a manager issue one', async () => {
    vi.spyOn(eventAdminApi, 'badge').mockRejectedValue(new ApiRequestError(404, 'not_found', 'No badge'));
    renderPanel(true);

    expect(await screen.findByText(/no badge has been issued|aucun badge/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /issue badge|émettre/i })).toBeInTheDocument();
  });

  it('shows the QR payload once after a reissue and hides it when done', async () => {
    vi.spyOn(eventAdminApi, 'badge').mockResolvedValue({
      id: 'b1', registrationId: 'r1', reference: 'REG-1', status: 'ISSUED', issuedAt: 'now', revokedAt: null, reissueCount: 0,
    });
    vi.spyOn(eventAdminApi, 'reissueBadge').mockResolvedValue({
      id: 'b1', registrationId: 'r1', reference: 'REG-1', status: 'ISSUED', issuedAt: 'now', revokedAt: null, reissueCount: 1, token: 'secret-token',
    });
    // happy-dom has no confirm dialog: provide one that accepts.
    window.confirm = vi.fn().mockReturnValue(true);
    renderPanel(true);

    fireEvent.click(await screen.findByRole('button', { name: /reissue|réémettre/i }));

    expect(await screen.findByText('ep-badge:secret-token')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /done|terminé/i }));
    await waitFor(() => expect(screen.queryByText('ep-badge:secret-token')).toBeNull());
  });

  it('shows state but no action buttons to a member without the manage capability', async () => {
    vi.spyOn(eventAdminApi, 'badge').mockResolvedValue({
      id: 'b1', registrationId: 'r1', reference: 'REG-1', status: 'ISSUED', issuedAt: 'now', revokedAt: null, reissueCount: 0,
    });
    renderPanel(false);

    expect(await screen.findByText(/REG-1/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reissue|révoquer|revoke|réémettre/i })).toBeNull();
  });
});
