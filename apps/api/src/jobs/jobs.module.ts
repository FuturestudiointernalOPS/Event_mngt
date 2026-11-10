import { Global, Module } from '@nestjs/common';
import { EMAIL_TRANSPORT } from '../integrations/email/email.tokens';
import { EMAIL_PORT, type EmailPort } from '../integrations/email/email.port';
import { IntegrationsModule } from '../integrations/integrations.module';
import { JobsService } from './jobs.service';
import { MAIL_QUEUE } from './jobs.tokens';
import { MailDispatcher } from './mail-dispatcher';
import { MailQueue } from './mail-queue';
import { RedisConnectionService } from './redis-connection.service';

/**
 * The durable job runner. Redis, when present, holds queued e-mail and export jobs so a
 * restart does not strand work; without it the adapters fall back to in-process execution.
 */
@Global()
@Module({
  imports: [IntegrationsModule],
  providers: [
    RedisConnectionService,
    {
      provide: MAIL_QUEUE,
      inject: [RedisConnectionService],
      useFactory: (redis: RedisConnectionService): MailQueue | null =>
        redis.options ? new MailQueue(redis.options) : null,
    },
    {
      provide: EMAIL_PORT,
      inject: [EMAIL_TRANSPORT, MAIL_QUEUE],
      useFactory: (transport: EmailPort, queue: MailQueue | null): EmailPort =>
        new MailDispatcher(transport, queue),
    },
    JobsService,
  ],
  exports: [RedisConnectionService, MAIL_QUEUE, EMAIL_PORT],
})
export class JobsModule {}
