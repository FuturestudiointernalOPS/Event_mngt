import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { bootstrapSession } from '@/services/auth.api';
import { I18nProvider } from './I18nProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Restores the session once on start. The access token is memory-only, so after a
 * reload the HttpOnly refresh cookie is exchanged for a new one.
 */
function SessionBootstrap({ children }: { children: ReactNode }): JSX.Element {
  useEffect(() => {
    void bootstrapSession();
  }, []);

  return <>{children}</>;
}

export function AppProviders({ children }: { children: ReactNode }): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <SessionBootstrap>{children}</SessionBootstrap>
      </I18nProvider>
    </QueryClientProvider>
  );
}
