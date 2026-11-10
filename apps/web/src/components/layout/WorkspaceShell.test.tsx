import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DEFAULT_BRANDING } from '@event-platform/shared';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/app/providers/I18nProvider';
import { capabilitiesApi } from '@/features/capabilities/capabilities.api';
import { WorkspaceShell } from './WorkspaceShell';

vi.mock('@/services/workspaces.api', () => ({
  workspacesApi: {
    context: vi.fn().mockResolvedValue({
      organization: { id: 'o1', slug: 'acme', name: 'Acme' },
      branding: DEFAULT_BRANDING,
      locale: { default: 'en', supported: ['fr', 'en'] },
    }),
  },
}));

vi.mock('@/features/capabilities/capabilities.api', () => ({
  capabilitiesApi: {
    self: vi.fn(),
  },
}));

function grant(effectiveCapabilities: string[]): void {
  vi.mocked(capabilitiesApi.self).mockResolvedValue({
    effectiveCapabilities,
  } as Awaited<ReturnType<typeof capabilitiesApi.self>>);
}

function renderShell(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/workspace/acme']}>
          <Routes>
            <Route path="/workspace/:slug" element={<WorkspaceShell />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('WorkspaceShell', () => {
  it('renders the loading state and then the shell without a hook-order error (regression)', async () => {
    // A hook added after the early "loading" return made React throw "Rendered more
    // hooks than during the previous render" as soon as the workspace context resolved.
    grant(['organization.view_members', 'organization.edit', 'organization.view_audit_log']);
    renderShell();

    expect(await screen.findByRole('link', { name: /privacy|confidentialité/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /audit/i })).toBeInTheDocument();
  });

  it('hides privacy and audit links from a member without those capabilities', async () => {
    grant([]);
    renderShell();

    await screen.findByRole('navigation');
    expect(screen.queryByRole('link', { name: /privacy|confidentialité/i })).toBeNull();
  });
});
