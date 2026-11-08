import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { LoadingState } from '@/components/ui/states';
import { useSessionStore } from '@/stores/session.store';

/**
 * Client-side route protection. This is convenience only: the API authorises every
 * request independently, so bypassing the UI grants nothing.
 */
export function RequireAuth({ children }: { children: ReactNode }): JSX.Element {
  const status = useSessionStore((state) => state.status);
  const sessionReady = useSessionStore((state) => state.sessionReady);

  if (!sessionReady) {
    return <LoadingState />;
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
