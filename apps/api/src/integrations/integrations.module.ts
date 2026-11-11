import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { ConsoleEmailAdapter } from './email/console-email.adapter';
import { EMAIL_TRANSPORT } from './email/email.tokens';
import { ConsoleStorageAdapter } from './storage/console-storage.adapter';
import { LocalStorageAdapter } from './storage/local-storage.adapter';
import { STORAGE_PORT } from './storage/storage.port';
import type { StoragePort } from './storage/storage.port';

/**
 * Provider adapters behind ports. The e-mail port itself is provided by JobsModule so it
 * can enqueue durably when Redis is configured; this module supplies the transport that
 * really sends.
 */
@Global()
@Module({
  providers: [
    { provide: EMAIL_TRANSPORT, useClass: ConsoleEmailAdapter },
    ConsoleStorageAdapter,
    LocalStorageAdapter,
    {
      provide: STORAGE_PORT,
      inject: [ConfigService, ConsoleStorageAdapter, LocalStorageAdapter],
      useFactory: (
        config: ConfigService<Env, true>,
        consoleAdapter: ConsoleStorageAdapter,
        localAdapter: LocalStorageAdapter,
      ): StoragePort =>
        // `console` only logs, so it is kept for tests and diagnostics. `s3` has no
        // adapter yet and falls back to the console one rather than pretending to store.
        config.get('STORAGE_PROVIDER', { infer: true }) === 'local'
          ? localAdapter
          : consoleAdapter,
    },
  ],
  exports: [EMAIL_TRANSPORT, STORAGE_PORT],
})
export class IntegrationsModule {}
