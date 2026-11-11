import type { Type } from '@nestjs/common';
import type { RouteDefinition } from './route-definition';
import { AuditModule } from '../../modules/audit/audit.module';
import { routes as auditRoutes } from '../../modules/audit/routes';
import { AnalyticsModule } from '../../modules/analytics/analytics.module';
import { routes as analyticsRoutes } from '../../modules/analytics/routes';
import { AuthModule } from '../../modules/auth/auth.module';
import { routes as authRoutes } from '../../modules/auth/routes';
import { BadgesModule } from '../../modules/badges/badges.module';
import { routes as badgeRoutes } from '../../modules/badges/routes';
import { CapabilitiesModule } from '../../modules/capabilities/capabilities.module';
import { routes as capabilityRoutes } from '../../modules/capabilities/routes';
import { CheckInModule } from '../../modules/check-in/check-in.module';
import { routes as checkInRoutes } from '../../modules/check-in/routes';
import { ConsentModule } from '../../modules/consent/consent.module';
import { routes as consentRoutes } from '../../modules/consent/routes';
import { EventsModule } from '../../modules/events/events.module';
import { routes as eventRoutes } from '../../modules/events/routes';
import { HealthModule } from '../../modules/health/health.module';
import { routes as healthRoutes } from '../../modules/health/routes';
import { IntroductionsModule } from '../../modules/introductions/introductions.module';
import { routes as introductionRoutes } from '../../modules/introductions/routes';
import { MeetingsModule } from '../../modules/meetings/meetings.module';
import { routes as meetingRoutes } from '../../modules/meetings/routes';
import { MembershipsModule } from '../../modules/memberships/memberships.module';
import { routes as membershipRoutes } from '../../modules/memberships/routes';
import { ModuleRegistryModule } from '../../modules/module-registry/module-registry.module';
import { routes as moduleRegistryRoutes } from '../../modules/module-registry/routes';
import { OrganizationsModule } from '../../modules/organizations/organizations.module';
import { routes as organizationRoutes } from '../../modules/organizations/routes';
import { ParticipantsModule } from '../../modules/participants/participants.module';
import { routes as participantRoutes } from '../../modules/participants/routes';
import { PlatformModule } from '../../modules/platform/platform.module';
import { routes as platformRoutes } from '../../modules/platform/routes';
import { ProfilesModule } from '../../modules/profiles/profiles.module';
import { routes as profileRoutes } from '../../modules/profiles/routes';
import { RegistrationFormsModule } from '../../modules/registration-forms/registration-forms.module';
import { routes as registrationFormRoutes } from '../../modules/registration-forms/routes';
import { RegistrationsModule } from '../../modules/registrations/registrations.module';
import { routes as registrationRoutes } from '../../modules/registrations/routes';
import { ReportsModule } from '../../modules/reports/reports.module';
import { routes as reportRoutes } from '../../modules/reports/routes';
import { WorkspacesModule } from '../../modules/workspaces/workspaces.module';
import { routes as workspaceRoutes } from '../../modules/workspaces/routes';

/**
 * The route catalogue is only useful if it cannot drift.
 *
 * The left side of every comparison is the hand-written `routes.ts`; the right side is
 * the decorator metadata on the real controllers. Adding a route without cataloguing it,
 * deleting a controller without removing its entry, or changing a permission now fails
 * here instead of in production.
 */

export const MODULES: Array<Type<unknown>> = [
  AnalyticsModule,
  AuditModule,
  AuthModule,
  BadgesModule,
  CapabilitiesModule,
  CheckInModule,
  ConsentModule,
  EventsModule,
  HealthModule,
  IntroductionsModule,
  MeetingsModule,
  MembershipsModule,
  ModuleRegistryModule,
  OrganizationsModule,
  ParticipantsModule,
  PlatformModule,
  ProfilesModule,
  RegistrationFormsModule,
  RegistrationsModule,
  ReportsModule,
  WorkspacesModule,
];

export const CATALOGUES: Record<string, RouteDefinition[]> = {
  analytics: analyticsRoutes,
  audit: auditRoutes,
  auth: authRoutes,
  badges: badgeRoutes,
  capabilities: capabilityRoutes,
  'check-in': checkInRoutes,
  consent: consentRoutes,
  events: eventRoutes,
  health: healthRoutes,
  introductions: introductionRoutes,
  meetings: meetingRoutes,
  memberships: membershipRoutes,
  'module-registry': moduleRegistryRoutes,
  organizations: organizationRoutes,
  participants: participantRoutes,
  platform: platformRoutes,
  profiles: profileRoutes,
  'registration-forms': registrationFormRoutes,
  registrations: registrationRoutes,
  reports: reportRoutes,
  workspaces: workspaceRoutes,
};

