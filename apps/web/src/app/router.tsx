import { PageFallback } from '@/components/ui/states';
import { WorkspaceShell } from '@/components/layout/WorkspaceShell';
import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import { RequireAuth } from './guards/RequireAuth';

const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/features/auth/pages/RegisterPage'));
const PlatformAdminPage = lazy(
  () => import('@/features/platform-admin/pages/PlatformAdminPage'),
);
const WorkspaceDashboardPage = lazy(
  () => import('@/features/workspace/pages/WorkspaceDashboardPage'),
);
const BrandingSettingsPage = lazy(
  () => import('@/features/branding/pages/BrandingSettingsPage'),
);
const EventsListPage = lazy(() => import('@/features/events/pages/EventsListPage'));
const EventCreatePage = lazy(() => import('@/features/events/pages/EventCreatePage'));
const EventDetailPage = lazy(() => import('@/features/events/pages/EventDetailPage'));
const PublicEventPage = lazy(() => import('@/features/public/pages/PublicEventPage'));
const EventRegistrationPage = lazy(
  () => import('@/features/public/pages/EventRegistrationPage'),
);
const CheckInPage = lazy(() => import('@/features/check-in/pages/CheckInPage'));
const ParticipantPage = lazy(
  () => import('@/features/participant/pages/ParticipantPage'),
);
const NotFoundPage = lazy(() => import('./NotFoundPage'));

function suspended(node: ReactNode): JSX.Element {
  return <Suspense fallback={<PageFallback />}>{node}</Suspense>;
}

/**
 * Route tree mirrors docs/09-frontend-architecture.md. The five experiences are
 * separated by URL prefix so they can evolve (and lazy-load) independently.
 */
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },

  // Auth
  { path: '/login', element: suspended(<LoginPage />) },
  { path: '/register', element: suspended(<RegisterPage />) },

  // Super Admin (Future Studio branding, cross-tenant views)
  {
    path: '/platform',
    element: <RequireAuth>{suspended(<PlatformAdminPage />)}</RequireAuth>,
  },

  // Organisation workspace
  {
    path: '/workspace/:slug',
    element: <RequireAuth>{suspended(<WorkspaceShell />)}</RequireAuth>,
    children: [
      { index: true, element: suspended(<WorkspaceDashboardPage />) },
      { path: 'events', element: suspended(<EventsListPage />) },
      { path: 'events/new', element: suspended(<EventCreatePage />) },
      { path: 'events/:eventId', element: suspended(<EventDetailPage />) },
      { path: 'settings/branding', element: suspended(<BrandingSettingsPage />) },
    ],
  },

  // Public event experience
  { path: '/e/:eventSlug', element: suspended(<PublicEventPage />) },
  { path: '/e/:eventSlug/register', element: suspended(<EventRegistrationPage />) },

  // Participant experience
  {
    path: '/participant',
    element: <RequireAuth>{suspended(<ParticipantPage />)}</RequireAuth>,
  },

  // Event staff / check-in
  {
    path: '/staff/:eventId/check-in',
    element: <RequireAuth>{suspended(<CheckInPage />)}</RequireAuth>,
  },

  { path: '*', element: suspended(<NotFoundPage />) },
]);
