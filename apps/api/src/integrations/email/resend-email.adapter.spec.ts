import { describe, expect, it, vi } from 'vitest';
import { EmailDeliveryError, ResendEmailAdapter, type FetchLike } from './resend-email.adapter';

const message = { to: 'ada@example.com', subject: 'Hello', text: 'Body' };

describe('ResendEmailAdapter', () => {
  it('posts the message with the API key and the configured sender', async () => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue({ ok: true, status: 200, text: async () => '{}' });
    await new ResendEmailAdapter('re_key', 'Events <no-reply@x.org>', fetchMock).send(message);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_key');
    expect(JSON.parse(init.body)).toEqual({ from: 'Events <no-reply@x.org>', to: ['ada@example.com'], subject: 'Hello', text: 'Body' });
  });

  it('raises a delivery error when the provider refuses, so a queue can retry', async () => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue({ ok: false, status: 422, text: async () => 'invalid from' });

    await expect(new ResendEmailAdapter('k', 'f', fetchMock).send(message)).rejects.toBeInstanceOf(EmailDeliveryError);
  });

  it('does not leak the API key into the error', async () => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized' });
    const error = await new ResendEmailAdapter('re_secret_key', 'f', fetchMock).send(message).catch((e: Error) => e);

    expect((error as Error).message).not.toContain('re_secret_key');
  });
});
