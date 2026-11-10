import { describe, expect, it, vi } from 'vitest';
import type { EmailMessage } from '../integrations/email/email.port';
import { MailDispatcher } from './mail-dispatcher';
import type { MailQueue } from './mail-queue';

const message: EmailMessage = { to: 'ada@example.test', subject: 'Hi', text: 'Body' };

function harness(queue: Partial<MailQueue> | null) {
  const transport = { send: vi.fn(async () => undefined) };
  const dispatcher = new MailDispatcher(transport, queue as MailQueue | null);
  return { dispatcher, transport };
}

describe('MailDispatcher', () => {
  it('enqueues when a durable queue is available', async () => {
    const queue = { enqueue: vi.fn(async () => undefined) };
    const { dispatcher, transport } = harness(queue);

    await dispatcher.send(message);

    expect(queue.enqueue).toHaveBeenCalledWith(message);
    expect(transport.send).not.toHaveBeenCalled();
  });

  it('sends inline when Redis is not configured', async () => {
    const { dispatcher, transport } = harness(null);

    await dispatcher.send(message);

    expect(transport.send).toHaveBeenCalledWith(message);
  });

  it('falls back to inline delivery when the queue write fails', async () => {
    const queue = {
      enqueue: vi.fn(async () => {
        throw new Error('redis down');
      }),
    };
    const { dispatcher, transport } = harness(queue);

    await dispatcher.send(message);

    expect(transport.send).toHaveBeenCalledWith(message);
  });
});
