import { Global, Module } from '@nestjs/common';
import { AuditRepository } from '../../common/audit/audit.repository';
import { AuditService } from '../../common/audit/audit.service';
import { AuditController } from './audit.controller';

/**
 * Global so any feature can record an action without importing this module. Only the
 * service is exported: the repository is an implementation detail.
 */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditRepository],
  exports: [AuditService],
})
export class AuditModule {}
