import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Badge } from '@event-platform/shared';
import { EMAIL_PORT, type EmailPort } from '../../integrations/email/email.port';
import { badgeQrPayload } from './badge.tokens';

/** What the caller needs to send the confirmation once its transaction commits. */
export interface IssuedBadgeNotice {
  badge: Badge;
  token: string | null;
  recipient: { email: string; name: string };
  event: { name: string; slug: string };
}

/**
 * Badge confirmation email (WP-13).
 *
 * Separate from issuance so the transaction boundary stays free of provider calls: the
 * service issues inside the caller's transaction, then hands the notice here. A provider
 * failure is logged and never undoes a badge that already exists.
 */
@Injectable()
export class BadgeNotifier {
  private readonly logger = new Logger(BadgeNotifier.name);

  constructor(@Inject(EMAIL_PORT) private readonly email: EmailPort) {}

  async notify(notice: IssuedBadgeNotice): Promise<void> {
    if (!notice.token) {
      return;
    }

    const lines = [
      `Hello ${notice.recipient.name},`,
      '',
      `Your registration ${notice.badge.reference} for ${notice.event.name} is approved.`,
      `Badge code: ${badgeQrPayload(notice.token)}`,
      '',
      'Show this code at the entrance. Reissuing your badge invalidates this one.',
    ];

    try {
      await this.email.send({
        to: notice.recipient.email,
        subject: `${notice.event.name} — your badge`,
        text: lines.join('\n'),
      });
    } catch (error) {
      this.logger.warn(
        `Badge email failed for registration ${notice.badge.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
