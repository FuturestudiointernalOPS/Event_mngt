import { describe, expect, it } from 'vitest';
import { parseRedisUrl } from './redis-connection';

describe('parseRedisUrl', () => {
  it('reads host, port and database', () => {
    expect(parseRedisUrl('redis://localhost:6380/2')).toMatchObject({
      host: 'localhost',
      port: 6380,
      db: 2,
    });
  });

  it('defaults the port and decodes credentials', () => {
    const parsed = parseRedisUrl('redis://default:p%40ss@cache.example.com');

    expect(parsed).toMatchObject({
      host: 'cache.example.com',
      port: 6379,
      username: 'default',
      password: 'p@ss',
    });
  });

  it('turns on TLS for rediss://', () => {
    expect(parseRedisUrl('rediss://cache.example.com:6379').tls).toEqual({});
  });

  it('refuses other schemes and keeps the BullMQ retry cap off', () => {
    expect(() => parseRedisUrl('http://x')).toThrow();
    expect(parseRedisUrl('redis://x').maxRetriesPerRequest).toBeNull();
  });
});
