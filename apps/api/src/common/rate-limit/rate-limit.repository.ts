import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Fixed-window counters.
 *
 * The increment is one statement, so two API instances cannot both read the same count
 * and then both write it back. The table is infrastructure: it holds a hashed caller
 * key, a window and a count, never product data.
 */
@Injectable()
export class RateLimitRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Removes windows that ended before the cutoff. Idempotent across API instances. */
  async purgeBefore(cutoff: Date): Promise<number> {
    const result = await this.prisma.rateLimitCounter.deleteMany({
      where: { windowStart: { lt: cutoff } },
    });
    return result.count;
  }

  async increment(key: string, startedAt: Date): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "rate_limit_counters" ("key", "window_start", "count")
      VALUES (${key}, ${startedAt}, 1)
      ON CONFLICT ("key", "window_start")
      DO UPDATE SET "count" = "rate_limit_counters"."count" + 1
      RETURNING "count"
    `;

    return Number(rows[0]?.count ?? 0);
  }
}
