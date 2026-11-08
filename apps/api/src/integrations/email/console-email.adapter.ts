import { Injectable, Logger } from '@nestjs/common';
import { EmailMessage, EmailPort } from './email.port';

/**
 * Development adapter: logs instead of sending. Used until a real provider is
 * configured (EMAIL_PROVIDER=resend|ses), which is a Phase 2 decision — see
 * docs/11-open-decisions.md (D5).
 */
@Injectable()
export class ConsoleEmailAdapter implements EmailPort {
  private readonly logger = new Logger(ConsoleEmailAdapter.name);

  async send(message: EmailMessage): Promise<void> {
    this.logger.log(
      `[email:console] to=${message.to} subject="${message.subject}"\n${message.text}`,
    );
  }
}
