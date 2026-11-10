import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  CAPABILITY_KEYS,
  createCheckInRequestSchema,
  listCheckInsQuerySchema,
  syncCheckInsRequestSchema,
  type CheckIn,
  type CheckInSummary,
  type CreateCheckInRequest,
  type ListCheckInsQuery,
  type SyncCheckInsRequest,
  type SyncCheckInsResponse,
} from '@event-platform/shared';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { Idempotent } from '../../common/idempotency/idempotency.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { RATE_LIMIT_BUDGETS } from '../../common/rate-limit/rate-limit.budgets';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import type { PaginatedResult } from '../../common/types/authenticated-user';
import { CheckInSyncService } from './check-in-sync.service';
import { CheckInsService } from './check-ins.service';

/**
 * Attendance for one event. The raw scanned value is only ever a request field; neither
 * a read nor a write echoes it back.
 */
@Controller('workspaces/:slug/events/:eventId')
@TenantScoped('slug')
export class CheckInsController {
  constructor(
    private readonly checkIns: CheckInsService,
    private readonly syncService: CheckInSyncService,
  ) {}

  @Post('check-ins')
  @RequireCapability(CAPABILITY_KEYS.checkInOperate)
  record(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body(new ZodValidationPipe(createCheckInRequestSchema))
    body: CreateCheckInRequest,
  ): Promise<CheckIn> {
    return this.checkIns.record(eventId, body);
  }

  @Post('check-ins/sync')
  @RequireCapability(CAPABILITY_KEYS.checkInOperate)
  @Idempotent()
  @RateLimit(...RATE_LIMIT_BUDGETS.operations.checkInSync)
  sync(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body(new ZodValidationPipe(syncCheckInsRequestSchema))
    body: SyncCheckInsRequest,
  ): Promise<SyncCheckInsResponse> {
    return this.syncService.sync(eventId, body);
  }

  @Get('check-ins')
  @RequireCapability(CAPABILITY_KEYS.checkInView)
  list(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Query(new ZodValidationPipe(listCheckInsQuerySchema))
    query: ListCheckInsQuery,
  ): Promise<PaginatedResult<CheckIn>> {
    return this.checkIns.list(eventId, query);
  }

  @Get('check-ins/summary')
  @RequireCapability(CAPABILITY_KEYS.checkInView)
  summary(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
  ): Promise<CheckInSummary> {
    return this.checkIns.summary(eventId);
  }
}
