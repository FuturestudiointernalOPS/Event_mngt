import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  PERMISSIONS,
  listBadgesQuerySchema,
  type Badge,
  type IssuedBadge,
  type ListBadgesQuery,
} from '@event-platform/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { PaginatedResult } from '../../common/types/authenticated-user';
import { BadgesService } from './badges.service';

/**
 * Badge state for one event. The raw token appears only in a reissue response; lists and
 * details deliberately cannot leak it.
 */
@Controller('workspaces/:slug/events/:eventId')
@TenantScoped('slug')
export class BadgesController {
  constructor(private readonly badges: BadgesService) {}

  @Get('badges')
  @RequirePermissions(PERMISSIONS.registrationRead)
  list(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Query(new ZodValidationPipe(listBadgesQuerySchema)) query: ListBadgesQuery,
  ): Promise<PaginatedResult<Badge>> {
    return this.badges.list(eventId, query);
  }

  @Get('registrations/:registrationId/badge')
  @RequirePermissions(PERMISSIONS.registrationRead)
  detail(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('registrationId', new ParseUUIDPipe()) registrationId: string,
  ): Promise<Badge | null> {
    return this.badges.getForRegistration(eventId, registrationId);
  }

  @Post('registrations/:registrationId/badge/reissue')
  @RequirePermissions(PERMISSIONS.registrationManage)
  reissue(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('registrationId', new ParseUUIDPipe()) registrationId: string,
  ): Promise<IssuedBadge> {
    return this.badges.reissue(eventId, registrationId);
  }

  @Post('registrations/:registrationId/badge/revoke')
  @RequirePermissions(PERMISSIONS.registrationManage)
  revoke(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('registrationId', new ParseUUIDPipe()) registrationId: string,
  ): Promise<Badge> {
    return this.badges.revoke(eventId, registrationId);
  }
}
