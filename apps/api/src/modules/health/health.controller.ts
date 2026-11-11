import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: the process is up and serving requests. */
  @Public()
  @Get()
  check(): { status: string; uptime: number } {
    return { status: 'ok', uptime: process.uptime() };
  }

  /** Readiness: the API can reach the database. Returns 503 when it cannot. */
  @Public()
  @Get('ready')
  async ready(): Promise<{ status: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        code: 'database_unreachable',
        message: 'The database is not reachable.',
      });
    }
    return { status: 'ready' };
  }
}
