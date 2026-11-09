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
 * Outgoing e-mail as background jobs: a slow or failing provider no longer slows or fails
 * the request that triggered the message, and transient failures are retried with
 * exponential backoff. Message bodies can carry one-time links, so finished jobs are
 * removed after an hour and failed ones after a day.
 */
export class MailQueue {
  private readonly queue: Queue;
  private worker: Worker | null = null;

  constructor(
    private readonly connection: RedisConnectionOptions,
    private readonly options: MailQueueOptions = {},
  ) {
    this.queue = new Queue(options.queueName ?? DEFAULT_QUEUE, { connection });
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
    this.worker = new Worker(this.options.queueName ?? DEFAULT_QUEUE, async (job) => transport.send(job.data as EmailMessage), {
      connection: this.connection,
      concurrency: this.options.concurrency ?? 5,
    });
    this.worker.on('failed', (job, error) => onFailure?.(error, job?.attemptsMade ?? 0));
  }

  async close(): Promise<void> {
    await this.worker?.close(true);
    await this.queue.close();
  }
}

/** The EmailPort the application sees when a queue is configured. */
export class QueuedEmailAdapter implements EmailPort {
  constructor(private readonly queue: MailQueue) {}

  send(message: EmailMessage): Promise<void> {
    return this.queue.enqueue(message);
  }
}
