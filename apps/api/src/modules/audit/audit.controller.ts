import { Controller, Get, Query } from '@nestjs/common';
import { CAPABILITY_KEYS, auditQuerySchema, type AuditQuery } from '@event-platform/shared';
import { AuditService } from '../../common/audit/audit.service';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

/**
 * Read-only audit surface. There is no route to change or delete an entry, because
 * an audit trail you can edit is not an audit trail.
 */
@Controller('workspaces')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @TenantScoped('slug')
  @RequireCapability(CAPABILITY_KEYS.organizationViewAuditLog)
  @Get(':slug/audit')
  list(@Query(new ZodValidationPipe(auditQuerySchema)) query: AuditQuery) {
    return this.audit.list(query);
  }
}
