import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * The single database client for the process.
 *
 * Feature code MUST NOT import PrismaClient directly and MUST NOT query
 * tenant-owned tables through this service. Use TenantTransactionService so the
 * transaction-local tenant context (and therefore row-level security) is set.
 * Direct use is reserved for: authentication/session lookups, tenant resolution
 * in guards, platform administration and health checks.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
