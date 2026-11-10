import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  CAPABILITY_KEYS,
  listBadgesQuerySchema,
  type Badge,
  type IssuedBadge,
  type ListBadgesQuery,
} from '@event-platform/shared';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
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
  @RequireCapability(CAPABILITY_KEYS.registrationsViewBadges)
  list(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Query(new ZodValidationPipe(listBadgesQuerySchema)) query: ListBadgesQuery,
  ): Promise<PaginatedResult<Badge>> {
    return this.badges.list(eventId, query);
  }

  @Get('registrations/:registrationId/badge')
  @RequireCapability(CAPABILITY_KEYS.registrationsViewBadges)
  detail(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('registrationId', new ParseUUIDPipe()) registrationId: string,
  ): Promise<Badge | null> {
    return this.badges.getForRegistration(eventId, registrationId);
  }

  @Post('registrations/:registrationId/badge/reissue')
  @RequireCapability(CAPABILITY_KEYS.registrationsManageBadges)
  reissue(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('registrationId', new ParseUUIDPipe()) registrationId: string,
  ): Promise<IssuedBadge> {
    return this.badges.reissue(eventId, registrationId);
  }

  @Post('registrations/:registrationId/badge/revoke')
  @RequireCapability(CAPABILITY_KEYS.registrationsManageBadges)
  revoke(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('registrationId', new ParseUUIDPipe()) registrationId: string,
  ): Promise<Badge> {
    return this.badges.revoke(eventId, registrationId);
  }
}
