import { Injectable, Logger } from '@nestjs/common';
import { EmailMessage, EmailPort } from './email.port';

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/** Raised when the provider refuses or cannot deliver a message. */
export class EmailDeliveryError extends Error {
  constructor(
    readonly status: number,
    detail: string,
  ) {
    super(`E-mail provider rejected the message (HTTP ${status}): ${detail}`);
    this.name = 'EmailDeliveryError';
  }
}

/** Sends through the Resend HTTP API. No SDK: one POST, easy to test and to replace. */
@Injectable()
export class ResendEmailAdapter implements EmailPort {
  private readonly logger = new Logger(ResendEmailAdapter.name);

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly doFetch: FetchLike = (url, init) => fetch(url, init),
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await this.doFetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html && { html: message.html }),
      }),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      this.logger.error(`Resend refused a message to ${message.to.replace(/(.).+@/, '$1***@')}: ${response.status}`);
      throw new EmailDeliveryError(response.status, detail);
    }
  }
}
