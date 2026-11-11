import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EventDetail } from '@event-platform/shared';
import { I18nProvider } from '@/app/providers/I18nProvider';
import { eventAdminApi } from '@/services/event-admin.api';
import { EventAppearance } from './EventAppearance';

const event: EventDetail = {
  id: 'e1',
  organizationId: 'o1',
  slug: 'village-2026',
  name: 'Innovation Village 2026',
  status: 'DRAFT',
  visibility: 'PRIVATE',
  format: 'IN_PERSON',
  timeZone: 'Africa/Porto-Novo',
  startsAt: '2026-11-10T09:00:00.000Z',
  endsAt: '2026-11-12T18:00:00.000Z',
  publishedAt: null,
  editionCount: 0,
  description: null,
  venueName: null,
  venueAddress: null,
  parentEventId: null,
  registrationOpensAt: null,
  registrationClosesAt: null,
  enabledModules: [],
  bannerUrl: null,
  brandOverrides: null,
};

function renderAppearance(): void {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <EventAppearance slug="acme" event={event} />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('EventAppearance', () => {
  it('saves only the colours the user changed', async () => {
    const update = vi
      .spyOn(eventAdminApi, 'update')
      .mockResolvedValue({ ...event, brandOverrides: { accentColor: '#123456' } });
    renderAppearance();

    const colours = document.querySelectorAll<HTMLInputElement>('input[type="color"]');
    expect(colours).toHaveLength(3);
    fireEvent.change(colours[2], { target: { value: '#123456' } });
    fireEvent.click(screen.getByRole('button', { name: /save|enregistrer/i }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('acme', 'e1', {
        brandOverrides: { accentColor: '#123456' },
      }),
    );
  });

  it('clears the overrides so the event inherits the workspace again', async () => {
    const update = vi.spyOn(eventAdminApi, 'update').mockResolvedValue(event);
    renderAppearance();

    fireEvent.click(
      screen.getByRole('button', { name: /workspace colours|reprendre les couleurs/i }),
    );

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('acme', 'e1', { brandOverrides: null }),
    );
  });

  it('sends the chosen file to the banner upload', async () => {
    const upload = vi.spyOn(eventAdminApi, 'uploadBanner').mockResolvedValue(event);
    renderAppearance();

    const file = new File(['image'], 'banner.png', { type: 'image/png' });
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });

    await waitFor(() => expect(upload).toHaveBeenCalledWith('acme', 'e1', file));
  });
});
