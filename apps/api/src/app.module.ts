import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
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
import { AuthModule } from './modules/auth/auth.module';
import { EventsModule } from './modules/events/events.module';
import { HealthModule } from './modules/health/health.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
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
    PermissionsModule,
    HealthModule,
    AuthModule,
    WorkspacesModule,
    EventsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantAccessGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
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
