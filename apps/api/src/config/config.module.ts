import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Env, validateEnv } from './env.validation';

/**
 * Typed accessor for validated environment values.
 *
 * This is only a type alias. Constructors must annotate the parameter with
 * `ConfigService<Env, true>` itself (not this alias), because decorator metadata
 * needs the runtime class to resolve the dependency.
 *
 * Read with:
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
