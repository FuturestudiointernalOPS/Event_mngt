import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { S3Client } from '@aws-sdk/client-s3';
import { ResendEmailAdapter } from './email/resend-email.adapter';
import { S3StorageAdapter } from './storage/s3-storage.adapter';
import { LocalStorageAdapter } from './storage/local-storage.adapter';
import { MailQueue, QueuedEmailAdapter } from '../jobs/mail-queue';
import { parseRedisUrl } from '../jobs/redis-connection';
import { EMAIL_TRANSPORT, MAIL_QUEUE } from './email/email.tokens';
import { ConsoleEmailAdapter } from './email/console-email.adapter';
import { EMAIL_PORT, type EmailPort } from './email/email.port';
import { ConsoleStorageAdapter } from './storage/console-storage.adapter';
import { STORAGE_PORT } from './storage/storage.port';

/**
 * Provider adapters behind ports. Selected by environment once real providers exist;
 * for Phase 1 the console adapters keep the seams testable without credentials.
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
      provide: MAIL_QUEUE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const url = config.get('REDIS_URL', { infer: true });
        return url ? new MailQueue(parseRedisUrl(url)) : null;
      },
    },
    {
      // Business code sends through this port and never knows whether a queue is behind it.
      provide: EMAIL_PORT,
      inject: [EMAIL_TRANSPORT, MAIL_QUEUE],
      useFactory: (transport: EmailPort, queue: MailQueue | null) =>
        queue ? new QueuedEmailAdapter(queue) : transport,
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
          : config.get('STORAGE_PROVIDER', { infer: true }) === 'local'
          ? new LocalStorageAdapter(
              config.get('STORAGE_LOCAL_DIR', { infer: true }),
              config.get('PUBLIC_API_URL', { infer: true }) ??
                `http://localhost:${config.get('PORT', { infer: true })}`,
            )
          : new ConsoleStorageAdapter(),
    },
  ],
  exports: [EMAIL_PORT, EMAIL_TRANSPORT, MAIL_QUEUE, STORAGE_PORT],
})
export class IntegrationsModule {}
