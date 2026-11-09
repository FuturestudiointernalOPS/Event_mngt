/**
 * Metadata redaction for the audit trail.
 *
 * The audit log is readable by organisation administrators, so a token, a password or
 * a session secret must never reach it — even when a caller passes one by accident.
 * Keys are compared without separators and in lower case, so `refresh_token`,
 * `refreshToken` and `REFRESH-TOKEN` are all caught.
 */

const REDACTED = '[redacted]';

const FORBIDDEN_KEYS = new Set([
  'password',
  'passwordhash',
  'passphrase',
  'token',
  'tokenhash',
  'refreshtoken',
  'refreshtokenhash',
  'accesstoken',
  'secret',
  'apikey',
  'authorization',
  'cookie',
  'csrftoken',
  'hash',
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function redactMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactMetadata);
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = FORBIDDEN_KEYS.has(normalizeKey(key)) ? REDACTED : redactMetadata(entry);
    }

    return result;
  }

  return value;
}
