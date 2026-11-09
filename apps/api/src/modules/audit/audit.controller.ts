import { Controller, Get, Query } from '@nestjs/common';
import { PERMISSIONS, paginationQuerySchema, type PaginationQuery } from '@event-platform/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { PaginatedResult } from '../../common/types/authenticated-user';
import { AuditService, type AuditLogView } from './audit.service';

@Controller('workspaces/:slug/audit-logs')
@TenantScoped('slug')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.auditRead)
  list(
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<PaginatedResult<AuditLogView>> {
    return this.audit.list(query);
  }
}
