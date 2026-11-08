import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Env, validateEnv } from './env.validation';

/**
 * Typed accessor for validated environment values.
 *
 * Inject as `AppConfigService` and read with:
 *   config.get('JWT_ACCESS_SECRET', { infer: true })  // string, never undefined
 */
export type AppConfigService = ConfigService<Env, true>;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
  ],
  exports: [ConfigModule],
})
export class CoreConfigModule {}
