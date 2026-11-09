import * as argon2 from 'argon2';

/** Argon2id parameters. Recorded here so they can be raised deliberately over time. */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

/** A malformed or foreign hash counts as "does not match", never as an error. */
export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password).catch(() => false);
}

/**
 * Burn comparable work when the account does not exist, so response time does not
 * reveal whether an email is registered.
 */
export async function equaliseTiming(password: string): Promise<void> {
  await argon2.hash(password, ARGON2_OPTIONS);
}
