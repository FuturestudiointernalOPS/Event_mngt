import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { EMAIL_TRANSPORT } from '../integrations/email/email.tokens';
import type { EmailPort } from '../integrations/email/email.port';
import { MAIL_QUEUE } from './jobs.tokens';
import type { MailQueue } from './mail-queue';

/**
 * Starts the durable mail consumer when Redis is configured and this instance is allowed
 * to run workers. Enqueueing still works on API-only instances, so they keep writing jobs.
 */
@Injectable()
export class JobsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    @Inject(EMAIL_TRANSPORT) private readonly transport: EmailPort,
    @Optional() @Inject(MAIL_QUEUE) private readonly mailQueue: MailQueue | null,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.mailQueue || !this.config.get('JOBS_WORKER_ENABLED', { infer: true })) {
      return;
    }

    this.mailQueue.start(this.transport, (error, attempts) =>
      this.logger.warn(`E-mail delivery failed (attempt ${attempts}): ${error.message}`),
    );
    this.logger.log('Background worker started (mail queue).');
  }

  async onModuleDestroy(): Promise<void> {
    await this.mailQueue?.close();
  }
}
