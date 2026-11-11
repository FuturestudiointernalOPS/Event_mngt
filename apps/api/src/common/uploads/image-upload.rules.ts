import { createHash } from 'node:crypto';
import { AppException } from '../app-exception';

/**
 * Image upload validation, as pure functions (R11).
 *
 * Allowlist, not blocklist: PNG, JPEG and WebP only. SVG is refused because it can
 * carry script and would be served from the same origin. The declared content type is
 * never trusted alone — the magic bytes decide.
 *
 * Shared by every upload surface (workspace logos and favicons, event banners) so the
 * rules cannot drift between them.
 */

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export interface ImageFile {
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface DetectedImage {
  contentType: 'image/png' | 'image/jpeg' | 'image/webp';
  extension: 'png' | 'jpeg' | 'webp';
}

const PNG: DetectedImage = { contentType: 'image/png', extension: 'png' };
const JPEG: DetectedImage = { contentType: 'image/jpeg', extension: 'jpeg' };
const WEBP: DetectedImage = { contentType: 'image/webp', extension: 'webp' };

function startsWith(buffer: Buffer, bytes: readonly number[]): boolean {
  return bytes.every((byte, index) => buffer[index] === byte);
}

export function detectImageType(buffer: Buffer): DetectedImage | null {
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return PNG;
  }

  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return JPEG;
  }

  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return WEBP;
  }

  return null;
}

export function inspectImageUpload(file: ImageFile | undefined): DetectedImage {
  if (!file || file.size === 0 || file.buffer.length === 0) {
    throw AppException.badRequest('file_required', 'Choose an image to upload.');
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw AppException.unprocessable(
      'file_too_large',
      `Images must be at most ${MAX_IMAGE_BYTES / (1024 * 1024)} MB.`,
    );
  }

  const detected = detectImageType(file.buffer);

  if (!detected) {
    throw AppException.unprocessable(
      'file_type_not_allowed',
      'Use a PNG, JPEG or WebP image.',
    );
  }

  if (file.mimetype !== detected.contentType) {
    throw AppException.unprocessable(
      'file_type_mismatch',
      'The file contents do not match the declared image type.',
    );
  }

  return detected;
}

/**
 * Content-addressed keys: the same bytes always land on the same object, and a
 * different file can never overwrite a previous asset silently.
 */
export function imageContentHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex').slice(0, 16);
}
