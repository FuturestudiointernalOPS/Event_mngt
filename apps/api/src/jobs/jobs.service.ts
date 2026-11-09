import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import type { Env } from '../config/env.validation';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../database/tenant-context.service';
import type { EmailPort } from '../integrations/email/email.port';
import { EMAIL_TRANSPORT, MAIL_QUEUE } from '../integrations/email/email.tokens';
import { DataRightsService } from '../modules/data-rights/data-rights.service';
import type { MailQueue } from './mail-queue';
import { parseRedisUrl } from './redis-connection';
import { runRetentionSweep } from './retention-job';

const MAINTENANCE = 'maintenance';

/**
 * Starts the background workers when Redis is configured: the mail consumer and the daily
 * retention sweep. Without REDIS_URL nothing starts and e-mail is sent inline.
 */
@Injectable()
export class JobsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private maintenanceQueue: Queue | null = null;
  private maintenanceWorker: Worker | null = null;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly rights: DataRightsService,
    @Inject(EMAIL_TRANSPORT) private readonly transport: EmailPort,
    @Optional() @Inject(MAIL_QUEUE) private readonly mailQueue: MailQueue | null,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const url = this.config.get('REDIS_URL', { infer: true });
    if (!url || !this.config.get('JOBS_WORKER_ENABLED', { infer: true })) {
      return;
    }

    this.mailQueue?.start(this.transport, (error, attempts) =>
      this.logger.warn(`E-mail delivery failed (attempt ${attempts}): ${error.message}`),
    );

    const connection = parseRedisUrl(url);
    this.maintenanceQueue = new Queue(MAINTENANCE, { connection });
    // Idempotent: restarting the app updates the same schedule instead of adding another.
    await this.maintenanceQueue.upsertJobScheduler('retention-sweep', { pattern: '0 3 * * *' }, { name: 'retention-sweep' });
    this.maintenanceWorker = new Worker(MAINTENANCE, async () => this.sweep(), { connection, concurrency: 1 });
    this.logger.log('Background workers started (mail, retention sweep).');
  }

  async sweep(): Promise<{ organisations: number; erased: number; failed: number }> {
    const result = await runRetentionSweep({
      // Settings of active organisations are public-readable by policy, so no tenant scope is needed to list.
      listOrganizations: async () =>
        (await this.prisma.workspaceSettings.findMany({
          where: { retentionMonths: { not: null }, organization: { status: 'ACTIVE' } },
          select: { organizationId: true, retentionMonths: true },
        })).map((row) => ({ organizationId: row.organizationId, retentionMonths: row.retentionMonths ?? 0 })),
      purge: (context) => this.tenantContext.run(context, () => this.rights.purgeExpired(false)),
      onError: (organizationId, error) =>
        this.logger.error(`Retention sweep failed for ${organizationId}: ${error instanceof Error ? error.message : String(error)}`),
    });
    this.logger.log(`Retention sweep: ${result.erased} erased across ${result.organisations} organisations (${result.failed} failed).`);
    return result;
  }

  async onModuleDestroy(): Promise<void> {
    await this.maintenanceWorker?.close(true);
    await this.maintenanceQueue?.close();
    await this.mailQueue?.close();
  }
}
