export interface RedisConnectionOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: Record<string, never>;
  /** BullMQ workers need unlimited retries per request or blocking commands fail. */
  maxRetriesPerRequest: null;
}

/** redis://user:pass@host:6379/0 or rediss:// (TLS) → connection options. */
export function parseRedisUrl(value: string): RedisConnectionOptions {
  const url = new URL(value);

  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    throw new Error('REDIS_URL must start with redis:// or rediss://');
  }

  const db = url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined;

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    ...(url.username && { username: decodeURIComponent(url.username) }),
    ...(url.password && { password: decodeURIComponent(url.password) }),
    ...(db !== undefined && !Number.isNaN(db) && { db }),
    ...(url.protocol === 'rediss:' && { tls: {} }),
    maxRetriesPerRequest: null,
  };
}
