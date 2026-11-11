import { PageFallback } from '@/components/ui/states';
import { WorkspaceShell } from '@/components/layout/WorkspaceShell';
import { RequireWorkspaceCapability } from '@/features/capabilities/components/RequireWorkspaceCapability';
import { CAPABILITY_KEYS } from '@event-platform/shared';
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
const AccessSettingsPage = lazy(
  () => import('@/features/capabilities/pages/AccessSettingsPage'),
);
const RetentionPage = lazy(() => import('@/features/workspace/pages/RetentionPage'));
const EventsListPage = lazy(() => import('@/features/events/pages/EventsListPage'));
const EventCreatePage = lazy(() => import('@/features/events/pages/EventCreatePage'));
const PublicEventPage = lazy(() => import('@/features/public/pages/PublicEventPage'));
const EventRegistrationPage = lazy(
  () => import('@/features/public/pages/EventRegistrationPage'),
);
const CheckInPage = lazy(() => import('@/features/check-in/pages/CheckInPage'));
const VerifyEmailPage = lazy(() => import('@/features/auth/pages/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/features/auth/pages/ResetPasswordPage'));
const OnboardingPage = lazy(() => import('@/features/onboarding/pages/OnboardingPage'));
const JoinPage = lazy(() => import('@/features/team/pages/JoinPage'));
const TeamPage = lazy(() => import('@/features/team/pages/TeamPage'));
const EventLayout = lazy(() => import('@/features/events/pages/EventLayout'));
const OverviewTab = lazy(() => import('@/features/events/tabs/OverviewTab'));
const ModulesTab = lazy(() => import('@/features/events/tabs/ModulesTab'));
const RegistrationSetupTab = lazy(() => import('@/features/events/tabs/RegistrationSetupTab'));
const RegistrationsTab = lazy(() => import('@/features/events/tabs/RegistrationsTab'));
const ShowcaseTab = lazy(() => import('@/features/events/tabs/ShowcaseTab'));
const NetworkingTab = lazy(() => import('@/features/events/tabs/NetworkingTab'));
const CheckInTab = lazy(() => import('@/features/events/tabs/CheckInTab'));
const ReportsTab = lazy(() => import('@/features/events/tabs/ReportsTab'));
const PublicShowcasePage = lazy(() => import('@/features/public/pages/PublicShowcasePage'));
const SecurityPage = lazy(() => import('@/features/account/pages/SecurityPage'));
const AuditPage = lazy(() => import('@/features/audit/pages/AuditPage'));
const ParticipantPage = lazy(() => import('@/features/participant/pages/ParticipantPage'));
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
  { path: '/verify-email', element: suspended(<VerifyEmailPage />) },
  { path: '/forgot-password', element: suspended(<ForgotPasswordPage />) },
  { path: '/reset-password', element: suspended(<ResetPasswordPage />) },
  { path: '/onboarding', element: <RequireAuth>{suspended(<OnboardingPage />)}</RequireAuth> },
  { path: '/account/security', element: <RequireAuth>{suspended(<SecurityPage />)}</RequireAuth> },
  { path: '/join', element: suspended(<JoinPage />) },

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
      {
        path: 'events',
        element: suspended(
          <RequireWorkspaceCapability capability={CAPABILITY_KEYS.eventsView}>
            <EventsListPage />
          </RequireWorkspaceCapability>,
        ),
      },
      {
        path: 'events/new',
        element: suspended(
          <RequireWorkspaceCapability capability={CAPABILITY_KEYS.eventsCreate}>
            <EventCreatePage />
          </RequireWorkspaceCapability>,
        ),
      },
      {
        path: 'events/:eventId',
        element: suspended(
          <RequireWorkspaceCapability capability={CAPABILITY_KEYS.eventsView}>
            <EventLayout />
          </RequireWorkspaceCapability>,
        ),
        children: [
          { index: true, element: suspended(<OverviewTab />) },
          { path: 'modules', element: suspended(<ModulesTab />) },
          { path: 'registration', element: suspended(<RegistrationSetupTab />) },
          { path: 'registrations', element: suspended(<RegistrationsTab />) },
          { path: 'showcase', element: suspended(<ShowcaseTab />) },
          { path: 'networking', element: suspended(<NetworkingTab />) },
          { path: 'check-in', element: suspended(<CheckInTab />) },
          { path: 'reports', element: suspended(<ReportsTab />) },
        ],
      },
      { path: 'team', element: suspended(<TeamPage />) },
      { path: 'audit', element: suspended(<AuditPage />) },
      {
        path: 'settings/branding',
        element: suspended(
          <RequireWorkspaceCapability capability={CAPABILITY_KEYS.organizationManageBranding}>
            <BrandingSettingsPage />
          </RequireWorkspaceCapability>,
        ),
      },
      {
        path: 'settings/retention',
        element: suspended(
          <RequireWorkspaceCapability capability={CAPABILITY_KEYS.registrationsErase}>
            <RetentionPage />
          </RequireWorkspaceCapability>,
        ),
      },
      {
        path: 'settings/access',
        element: suspended(
          <RequireWorkspaceCapability capability={CAPABILITY_KEYS.organizationViewMembers}>
            <AccessSettingsPage />
          </RequireWorkspaceCapability>,
        ),
      },
    ],
  },

  // Public event experience
  { path: '/e/:eventSlug', element: suspended(<PublicEventPage />) },
  { path: '/e/:eventSlug/register', element: suspended(<EventRegistrationPage />) },
  { path: '/e/:eventSlug/showcase', element: suspended(<PublicShowcasePage />) },

  // Participant experience: opened from the link in the badge e-mail, authenticated by its
  // credential rather than by a staff session.
  { path: '/participant', element: suspended(<ParticipantPage />) },

  // Event staff / check-in
  {
    path: '/staff/:slug/:eventId/check-in',
    element: <RequireAuth>{suspended(<CheckInPage />)}</RequireAuth>,
  },

  { path: '*', element: suspended(<NotFoundPage />) },
]);
