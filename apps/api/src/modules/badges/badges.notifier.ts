import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { composeParticipantCredential, type Badge } from '@event-platform/shared';
import type { Env } from '../../config/env.validation';
import { EMAIL_PORT, type EmailPort } from '../../integrations/email/email.port';
import { badgeQrPayload } from './badge.tokens';

/** What the caller needs to send the confirmation once its transaction commits. */
export interface IssuedBadgeNotice {
  organizationId: string;
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

  constructor(
    @Inject(EMAIL_PORT) private readonly email: EmailPort,
    private readonly config: ConfigService<Env, true>,
  ) {}

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
      '',
      'Your participant space (badge QR, your data, meetings):',
      this.portalLink(notice),
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

  /** The secret travels in the URL fragment-free query only to the participant's own e-mail. */
  private portalLink(notice: IssuedBadgeNotice): string {
    const base = this.config.get('WEB_APP_URL', { infer: true }).replace(/\/+$/, '');
    const credential = composeParticipantCredential(
      notice.organizationId,
      notice.badge.registrationId,
      notice.token ?? '',
    );
    return `${base}/participant?credential=${encodeURIComponent(credential)}`;
  }
}
