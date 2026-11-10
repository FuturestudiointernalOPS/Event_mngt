import { Global, Module } from '@nestjs/common';
import { ConsoleEmailAdapter } from './email/console-email.adapter';
import { EMAIL_TRANSPORT } from './email/email.tokens';
import { ConsoleStorageAdapter } from './storage/console-storage.adapter';
import { STORAGE_PORT } from './storage/storage.port';

/**
 * Provider adapters behind ports. The e-mail port itself is provided by JobsModule so it
 * can enqueue durably when Redis is configured; this module supplies the transport that
 * really sends.
 */
@Global()
@Module({
  providers: [
    { provide: EMAIL_TRANSPORT, useClass: ConsoleEmailAdapter },
    { provide: STORAGE_PORT, useClass: ConsoleStorageAdapter },
  ],
  exports: [EMAIL_TRANSPORT, STORAGE_PORT],
})
export class IntegrationsModule {}
