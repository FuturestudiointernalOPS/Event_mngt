import { Global, Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';

/**
 * Global so the tenant and permission guards can resolve membership without every
 * feature module importing this one.
 */
@Global()
@Module({
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
