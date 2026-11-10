import { afterEach, describe, expect, it } from 'vitest';
import type { EmailMessage } from '../integrations/email/email.port';
import { MailQueue } from './mail-queue';
import { parseRedisUrl } from './redis-connection';

/** Needs a Redis: set REDIS_TEST_URL (e.g. redis://localhost:63799). Skipped otherwise. */
const redisUrl = process.env.REDIS_TEST_URL;
const queueName = () => `mail-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const message: EmailMessage = { to: 'ada@example.com', subject: 'Hi', text: 'Body' };

const waitFor = async (condition: () => boolean, ms = 8000): Promise<void> => {
  const end = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > end) throw new Error('Timed out waiting for the condition');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

describe.skipIf(!redisUrl)('MailQueue (against Redis)', () => {
  const open: MailQueue[] = [];
  afterEach(async () => {
    await Promise.all(open.splice(0).map((queue) => queue.close()));
  });

  it('delivers a queued message through the transport', async () => {
    const sent: EmailMessage[] = [];
    const queue = new MailQueue(parseRedisUrl(redisUrl ?? ''), {
      backoffMs: 50,
      queueName: queueName(),
    });
    open.push(queue);
    queue.start({ send: async (entry) => void sent.push(entry) });

    await queue.enqueue({ ...message, subject: `deliver-${Date.now()}` });
    await waitFor(() => sent.length >= 1);

    expect(sent[0].to).toBe('ada@example.com');
  });

  it('retries a transient provider failure and then succeeds', async () => {
    let calls = 0;
    const queue = new MailQueue(parseRedisUrl(redisUrl ?? ''), {
      backoffMs: 50,
      attempts: 4,
      queueName: queueName(),
    });
    open.push(queue);
    queue.start({
      send: async () => {
        calls += 1;
        if (calls < 3) throw new Error('provider unavailable');
      },
    });

    await queue.enqueue({ ...message, subject: `retry-${Date.now()}` });
    await waitFor(() => calls >= 3);

    expect(calls).toBe(3);
  });

  it('gives up after the configured attempts and reports each failure', async () => {
    const failures: number[] = [];
    const queue = new MailQueue(parseRedisUrl(redisUrl ?? ''), {
      backoffMs: 30,
      attempts: 2,
      queueName: queueName(),
    });
    open.push(queue);
    queue.start({ send: async () => Promise.reject(new Error('down')) }, (_error, attempts) =>
      failures.push(attempts),
    );

    await queue.enqueue({ ...message, subject: `giveup-${Date.now()}` });
    await waitFor(() => failures.length >= 2);
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(failures).toEqual([1, 2]);
  });
});
