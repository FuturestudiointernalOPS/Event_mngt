import { Logger } from '@nestjs/common';
import type { EmailMessage, EmailPort } from '../integrations/email/email.port';
import type { MailQueue } from './mail-queue';

/**
 * The port the application sees. When Redis is configured it enqueues a durable job;
 * otherwise — or when Redis is unreachable — it sends inline so a message is not lost.
 */
export class MailDispatcher implements EmailPort {
  private readonly logger = new Logger(MailDispatcher.name);

  constructor(
    private readonly transport: EmailPort,
    private readonly queue: MailQueue | null,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    if (this.queue) {
      try {
        await this.queue.enqueue(message);
        return;
      } catch (error) {
        this.logger.warn(
          `Mail queue unavailable, sending inline: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    await this.transport.send(message);
  }
}
