import { Logger } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import type { EmailMessage, EmailPort } from '../integrations/email/email.port';
import type { RedisConnectionOptions } from './redis-connection';

export interface MailQueueOptions {
  /** Delay before the first retry; doubles each attempt. */
  backoffMs?: number;
  attempts?: number;
  concurrency?: number;
  /** Queue name. Tests use a unique one so a running API's worker cannot consume their jobs. */
  queueName?: string;
}

const DEFAULT_QUEUE = 'mail';

/**
 * Outgoing e-mail as background jobs: a provider outage no longer fails the request that
 * triggered the message, and the job survives an API restart. Message bodies can carry
 * one-time links, so finished jobs are removed after an hour and failed ones after a day.
 */
export class MailQueue {
  private readonly logger = new Logger(MailQueue.name);
  private readonly queue: Queue<EmailMessage>;
  private worker: Worker<EmailMessage> | null = null;

  constructor(
    private readonly connection: RedisConnectionOptions,
    private readonly options: MailQueueOptions = {},
  ) {
    this.queue = new Queue(this.name, { connection });
    this.queue.on('error', (error) =>
      this.logger.error(`Mail queue error: ${error.message}`),
    );
  }

  async enqueue(message: EmailMessage): Promise<void> {
    await this.queue.add('send', message, {
      attempts: this.options.attempts ?? 5,
      backoff: { type: 'exponential', delay: this.options.backoffMs ?? 5_000 },
      removeOnComplete: { age: 3_600 },
      removeOnFail: { age: 86_400 },
    });
  }

  /** Starts consuming. A rejected promise from the transport makes BullMQ retry the job. */
  start(transport: EmailPort, onFailure?: (error: Error, attemptsMade: number) => void): void {
    this.worker = new Worker(
      this.name,
      async (job) => transport.send(job.data),
      { connection: this.connection, concurrency: this.options.concurrency ?? 5 },
    );
    this.worker.on('failed', (job, error) => onFailure?.(error, job?.attemptsMade ?? 0));
    this.worker.on('error', (error) =>
      this.logger.error(`Mail worker error: ${error.message}`),
    );
  }

  async close(): Promise<void> {
    await this.worker?.close(true);
    await this.queue.close();
  }

  private get name(): string {
    return this.options.queueName ?? DEFAULT_QUEUE;
  }
}
