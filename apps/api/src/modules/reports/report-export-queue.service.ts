import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import type { Env } from '../../config/env.validation';
import type { TenantContext } from '../../database/tenant-context.service';
import { RedisConnectionService } from '../../jobs/redis-connection.service';
import { ReportExportWorker } from './report-export-worker.service';

const QUEUE_NAME = 'report-exports';
const ATTEMPTS = 3;

interface ExportJobData {
  exportId: string;
  context: TenantContext;
}

/**
 * Durable export scheduling. A completed request answers 202 immediately, while Redis
 * holds the job until a worker finishes it. The row itself remains the source of truth:
 * the worker claims it atomically, so re-delivery is harmless.
 */
@Injectable()
export class ReportExportQueue implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ReportExportQueue.name);
  private queue: Queue<ExportJobData> | null = null;
  private worker: Worker<ExportJobData> | null = null;

  constructor(
    private readonly redis: RedisConnectionService,
    private readonly processor: ReportExportWorker,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.redis.options) {
      return;
    }

    this.queue = new Queue(QUEUE_NAME, { connection: this.redis.options });
    this.queue.on('error', (error) =>
      this.logger.error(`Export queue error: ${error.message}`),
    );

    if (!this.config.get('JOBS_WORKER_ENABLED', { infer: true })) {
      return;
    }

    this.worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        const attempt = job.attemptsMade + 1;
        const maxAttempts = job.opts.attempts ?? 1;
        await this.processor.process(job.data.exportId, job.data.context, {
          attempt,
          maxAttempts,
        });
      },
      { connection: this.redis.options, concurrency: 1 },
    );

    this.worker.on('failed', (job, error) =>
      this.logger.error(
        `Export job ${job?.data.exportId ?? 'unknown'} failed: ${error.message}`,
      ),
    );
    this.worker.on('error', (error) =>
      this.logger.error(`Export worker error: ${error.message}`),
    );
  }

  /** True when the job was accepted by the durable queue. */
  async enqueue(exportId: string, context: TenantContext): Promise<boolean> {
    if (!this.queue) {
      return false;
    }

    await this.queue.add('generate', { exportId, context }, {
      jobId: exportId,
      attempts: ATTEMPTS,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { age: 3_600 },
      removeOnFail: { age: 86_400 },
    });

    return true;
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close(true);
    await this.queue?.close();
  }
}
