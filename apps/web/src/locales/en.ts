import { enFeatures } from './en.features';
export const en = {
  'app.name': 'Event Platform',
  'common.loading': 'Loading…',
  'common.error': 'Something went wrong.',
  'common.retry': 'Try again',
  'common.save': 'Save changes',
  'common.saving': 'Saving…',
  'common.cancel': 'Cancel',
  'common.search': 'Search',
  'common.empty': 'Nothing here yet.',
  'common.required': 'This field is required.',

  'nav.dashboard': 'Dashboard',
  'nav.events': 'Events',
  'nav.team': 'Team',
  'nav.branding': 'Branding',
  'nav.access': 'Access',
  'nav.reports': 'Reports',
  'nav.signOut': 'Sign out',
  'nav.backToSite': 'Back to public site',

  'auth.title': 'Sign in',
  'auth.registerTitle': 'Create an account',
  'auth.email': 'Email address',
  'auth.password': 'Password',
  'auth.displayName': 'Full name',
  'auth.signIn': 'Sign in',
  'auth.signingIn': 'Signing in…',
  'auth.createAccount': 'Create account',
  'auth.needAccount': 'Need an account?',
  'auth.haveAccount': 'Already have an account?',
  'auth.checkEmail': 'Check your email to confirm your address, then sign in.',
  'auth.forgotPassword': 'Forgot your password?',

  'workspace.dashboard.title': 'Workspace',
  'workspace.dashboard.subtitle': 'Your organisation, events and reports in one place.',
  'workspace.onboarding': 'Finish setting up your workspace',
  'workspace.branding.title': 'Branding',
  'workspace.branding.subtitle':
    'These values are applied across your workspace, public pages and badges.',
  'workspace.branding.contrastWarning':
    'Contrast below {required}:1 for {pair} (currently {ratio}:1). Text may be hard to read.',
  'workspace.branding.saved': 'Branding saved.',

  'events.title': 'Events',
  'events.new': 'New event',
  'events.empty': 'No events yet. Create your first event to get started.',
  'events.name': 'Event name',
  'events.slug': 'Web address',
  'events.format': 'Format',
  'events.visibility': 'Visibility',
  'events.timeZone': 'Time zone',
  'events.startsAt': 'Starts',
  'events.endsAt': 'Ends',
  'events.venue': 'Venue',
  'events.status': 'Status',
  'events.publish': 'Publish event',
  'events.published': 'Published',
  'events.create': 'Create draft',
  'events.creating': 'Creating…',
  'events.modules': 'Enabled modules',
  'events.details.title': 'Event details',

  'access.title': 'Member access',
  'access.subtitle':
    'Choose a member to see their effective capabilities and grant or revoke direct access.',
  'access.entitlement':
    'Your organisation is entitled to {granted} of {total} capabilities in the catalogue.',
  'access.readOnly':
    'You can inspect these permissions, but changing them requires the “Manage member permissions” capability.',
  'access.member': 'Member',
  'access.role': 'Role',
  'access.effective': 'Effective capabilities',
  'access.direct': 'Direct grants',

  'capabilities.sensitive': 'Sensitive',
  'capabilities.destructive': 'Destructive',
  'capabilities.missingDependencies': 'Ineffective until these are also granted: {dependencies}',

  'public.register': 'Register',
  'public.details': 'Event details',
  'public.organisedBy': 'Organised by',

  'checkin.title': 'Check-in',
  'checkin.subtitle': 'Scans are stored on this device first, then synchronised.',
  'checkin.queue': 'Queued scans',
  'checkin.queued': 'Scan saved — waiting to be synchronised',
  'checkin.sync': 'Synchronise now',
  'checkin.addScan': 'Simulate scan',
  'checkin.online': 'Connected',
  'checkin.offline': 'Offline — scans are queued',
  'checkin.empty': 'No queued scans.',

  'platform.title': 'Platform administration',
  'platform.subtitle': 'Future Studio view across organisations.',
  'platform.organization': 'Organisation',
  'platform.entitlement':
    '{organization} is entitled to {granted} of {total} capabilities. Unchecking one revokes it for every member immediately.',
  'platform.enabled': 'Enabled',
  'platform.forbidden': 'Platform administrators only',
  'platform.forbiddenBody':
    'This area manages organisation entitlements across the platform and is unavailable to workspace roles.',

  'participant.title': 'Your event space',
  'participant.subtitle': 'Badge, profile, meetings and requests.',

  'notFound.title': 'Page not found',
  'notFound.body': 'The page you are looking for does not exist.',
  ...enFeatures,
} as const;

export type TranslationKey = keyof typeof en;
