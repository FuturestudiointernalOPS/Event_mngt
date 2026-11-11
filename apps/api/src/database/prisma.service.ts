import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Env } from '../config/env.validation';
import { PrismaClient } from './prisma-client';

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

  constructor(config: ConfigService<Env, true>) {
    // Prisma 7 removed the Rust query engine: every client is built from a driver
    // adapter, and the connection pool is node-postgres' own.
    //
    // The runtime prefers APP_DATABASE_URL (the non-owner role) so row-level security
    // applies. DATABASE_URL remains the migration owner used by the Prisma CLI.
    super({
      adapter: new PrismaPg({
        connectionString:
          config.get('APP_DATABASE_URL', { infer: true }) ??
          config.get('DATABASE_URL', { infer: true }),
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Prisma connected');
    } catch (error) {
      // Do not kill the process. Readiness reports the problem and Prisma retries lazily
      // on the first query, so a temporarily unreachable database does not turn into a
      // boot loop where the only diagnostic is a stack trace.
      this.logger.error(
        'Could not reach PostgreSQL at startup. Check DATABASE_URL in apps/api/.env. ' +
          'With Supabase, use the Session pooler connection string and sslmode=require; ' +
          'the direct db.<ref>.supabase.co host is IPv6-only by default.',
      );
      this.logger.error(error instanceof Error ? error.message : String(error));
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
