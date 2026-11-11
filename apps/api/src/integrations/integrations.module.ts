import { S3Client } from '@aws-sdk/client-s3';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { ConsoleEmailAdapter } from './email/console-email.adapter';
import { EMAIL_TRANSPORT } from './email/email.tokens';
import { ResendEmailAdapter } from './email/resend-email.adapter';
import { ConsoleStorageAdapter } from './storage/console-storage.adapter';
import { S3StorageAdapter } from './storage/s3-storage.adapter';
import { STORAGE_PORT } from './storage/storage.port';

/**
 * Provider adapters behind ports, chosen by configuration at boot (the environment
 * contract refuses a selected provider that is not fully configured). The e-mail port itself
 * is provided by JobsModule so it can enqueue durably when Redis is configured; this module
 * supplies the transport that really sends.
 */
@Global()
@Module({
  providers: [
    {
      provide: EMAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get('EMAIL_PROVIDER', { infer: true }) === 'resend'
          ? new ResendEmailAdapter(
              config.get('RESEND_API_KEY', { infer: true }) ?? '',
              config.get('EMAIL_FROM', { infer: true }),
            )
          : new ConsoleEmailAdapter(),
    },
    {
      provide: STORAGE_PORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get('STORAGE_PROVIDER', { infer: true }) === 's3'
          ? new S3StorageAdapter(
              new S3Client({
                region: config.get('S3_REGION', { infer: true }),
                endpoint: config.get('S3_ENDPOINT', { infer: true }),
                // Path-style addressing keeps S3-compatible services (MinIO, R2) working.
                forcePathStyle: Boolean(config.get('S3_ENDPOINT', { infer: true })),
                credentials: {
                  accessKeyId: config.get('S3_ACCESS_KEY_ID', { infer: true }) ?? '',
                  secretAccessKey: config.get('S3_SECRET_ACCESS_KEY', { infer: true }) ?? '',
                },
              }),
              config.get('S3_BUCKET', { infer: true }) ?? '',
              config.get('S3_PUBLIC_BASE_URL', { infer: true }) ?? '',
            )
          : new ConsoleStorageAdapter(),
    },
  ],
  exports: [EMAIL_TRANSPORT, STORAGE_PORT],
})
export class IntegrationsModule {}
