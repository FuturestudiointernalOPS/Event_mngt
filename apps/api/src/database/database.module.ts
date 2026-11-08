import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantContextService } from './tenant-context.service';
import { TenantTransactionService } from './tenant-transaction.service';

/**
 * Global data-access module. Feature modules never construct clients: they inject
 * TenantTransactionService and receive a tenant-scoped transaction client.
 */
@Global()
@Module({
  providers: [PrismaService, TenantContextService, TenantTransactionService],
  exports: [PrismaService, TenantContextService, TenantTransactionService],
})
export class DatabaseModule {}
