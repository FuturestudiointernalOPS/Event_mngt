import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { IdempotencyInterceptor } from './common/idempotency/idempotency.interceptor';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { RateLimitGuard } from './common/rate-limit/rate-limit.guard';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { TenantAccessGuard } from './common/guards/tenant-access.guard';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { TenantContextInterceptor } from './common/interceptors/tenant-context.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { ttlToSeconds } from './common/utils/tokens';
import { AppConfigService, CoreConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { AuditModule } from './modules/audit/audit.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuthModule } from './modules/auth/auth.module';
import { BadgesModule } from './modules/badges/badges.module';
import { CheckInModule } from './modules/check-in/check-in.module';
import { ConsentModule } from './modules/consent/consent.module';
import { EventsModule } from './modules/events/events.module';
import { HealthModule } from './modules/health/health.module';
import { IntroductionsModule } from './modules/introductions/introductions.module';
import { MeetingsModule } from './modules/meetings/meetings.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { ModuleRegistryModule } from './modules/module-registry/module-registry.module';
import { ParticipantsModule } from './modules/participants/participants.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { RegistrationFormsModule } from './modules/registration-forms/registration-forms.module';
import { RegistrationsModule } from './modules/registrations/registrations.module';
import { ReportsModule } from './modules/reports/reports.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';

/**
 * Composition root. Guards are registered in execution order:
 *   1. JwtAuthGuard        — who are you?
 *   2. TenantAccessGuard   — which workspace, and are you a member?
 *   3. PermissionsGuard    — may you perform this action here?
 *
 * Domain modules are added here as phases land; the pipeline is already in place.
 */
@Module({
  imports: [
    CoreConfigModule,
    DatabaseModule,
    IntegrationsModule,
    IdempotencyModule,
    RateLimitModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        // Numeric seconds avoid relying on jsonwebtoken's `StringValue` template type.
        signOptions: {
          expiresIn: ttlToSeconds(config.get('JWT_ACCESS_TTL', { infer: true })),
        },
      }),
    }),
    AuditModule,
    PermissionsModule,
    HealthModule,
    AnalyticsModule,
    AuthModule,
    WorkspacesModule,
    MembershipsModule,
    ModuleRegistryModule,
    EventsModule,
    ConsentModule,
    RegistrationFormsModule,
    BadgesModule,
    CheckInModule,
    RegistrationsModule,
    ProfilesModule,
    ParticipantsModule,
    IntroductionsModule,
    MeetingsModule,
    ReportsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantAccessGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Nest 11 runs on Express 5, which uses path-to-regexp v8: a bare '*' is no longer
    // a valid pattern. Named wildcards are required.
    consumer.apply(RequestIdMiddleware).forRoutes('{*splat}');
  }
}
