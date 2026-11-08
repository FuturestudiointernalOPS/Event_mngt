import { Controller, Get } from '@nestjs/common';
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

  /** Readiness: the API can reach the database. */
  @Public()
  @Get('ready')
  async ready(): Promise<{ status: string }> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ready' };
  }
}
