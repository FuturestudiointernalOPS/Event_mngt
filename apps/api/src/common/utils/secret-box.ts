import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

/**
 * Authenticated encryption (AES-256-GCM) for secrets stored in the database, such as MFA
 * seeds. The key is derived from an application secret; a tampered value fails to decrypt.
 */
export function deriveKey(secret: string, purpose: string): Buffer {
  return createHmac('sha256', secret).update(purpose).digest();
}

export function encryptSecret(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString('base64url')).join('.');
}

export function decryptSecret(sealed: string, key: Buffer): string {
  const [iv, tag, body] = sealed.split('.').map((part) => Buffer.from(part, 'base64url'));
  if (!iv || !tag || !body) {
    throw new Error('Malformed sealed value');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}
