import { Global, Module } from '@nestjs/common';
import { ConsoleEmailAdapter } from './email/console-email.adapter';
import { EMAIL_PORT } from './email/email.port';
import { ConsoleStorageAdapter } from './storage/console-storage.adapter';
import { STORAGE_PORT } from './storage/storage.port';

/**
 * Provider adapters behind ports. Selected by environment once real providers exist;
 * for Phase 1 the console adapters keep the seams testable without credentials.
 */
@Global()
@Module({
  providers: [
    { provide: EMAIL_PORT, useClass: ConsoleEmailAdapter },
    { provide: STORAGE_PORT, useClass: ConsoleStorageAdapter },
  ],
  exports: [EMAIL_PORT, STORAGE_PORT],
})
export class IntegrationsModule {}
