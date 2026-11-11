import { describe, expect, it } from 'vitest';
import { AppException } from '../app-exception';
import {
  MAX_IMAGE_BYTES,
  detectImageType,
  imageContentHash,
  inspectImageUpload,
} from './image-upload.rules';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const webp = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP'),
  Buffer.from([0x00]),
]);
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

function capture(fn: () => void): AppException {
  try {
    fn();
  } catch (error) {
    if (error instanceof AppException) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected the call to throw');
}

function file(overrides: Partial<{ mimetype: string; size: number; buffer: Buffer }> = {}) {
  const buffer = overrides.buffer ?? png;
  return {
    mimetype: overrides.mimetype ?? 'image/png',
    size: overrides.size ?? buffer.length,
    buffer,
  };
}

describe('detectImageType', () => {
  it('recognises the three allowed formats by their magic bytes', () => {
    expect(detectImageType(png)?.extension).toBe('png');
    expect(detectImageType(jpeg)?.extension).toBe('jpeg');
    expect(detectImageType(webp)?.extension).toBe('webp');
  });

  it('does not recognise SVG or an arbitrary payload', () => {
    expect(detectImageType(svg)).toBeNull();
    expect(detectImageType(Buffer.from('not an image'))).toBeNull();
  });
});

describe('inspectImageUpload', () => {
  it('accepts each allowed type', () => {
    expect(inspectImageUpload(file())).toMatchObject({ contentType: 'image/png' });
    expect(inspectImageUpload(file({ mimetype: 'image/jpeg', buffer: jpeg }))).toMatchObject({
      contentType: 'image/jpeg',
    });
    expect(inspectImageUpload(file({ mimetype: 'image/webp', buffer: webp }))).toMatchObject({
      contentType: 'image/webp',
    });
  });

  it('refuses SVG even when labelled as an image', () => {
    const error = capture(() => inspectImageUpload(file({ mimetype: 'image/svg+xml', buffer: svg })));

    expect(error.code).toBe('file_type_not_allowed');
  });

  it('refuses a file whose bytes contradict the declared type', () => {
    const error = capture(() => inspectImageUpload(file({ mimetype: 'image/jpeg', buffer: png })));

    expect(error.code).toBe('file_type_mismatch');
  });

  it('refuses a file above the size limit before it reaches storage', () => {
    const error = capture(() => inspectImageUpload(file({ size: MAX_IMAGE_BYTES + 1 })));

    expect(error.code).toBe('file_too_large');
  });

  it('refuses an empty or absent upload', () => {
    expect(capture(() => inspectImageUpload(undefined)).code).toBe('file_required');
    expect(capture(() => inspectImageUpload(file({ buffer: Buffer.alloc(0), size: 0 }))).code).toBe(
      'file_required',
    );
  });
});

describe('imageContentHash', () => {
  it('is content-addressed: the same bytes produce the same hash', () => {
    expect(imageContentHash(png)).toBe(imageContentHash(Buffer.from(png)));
  });

  it('changes when the bytes change', () => {
    expect(imageContentHash(png)).not.toBe(imageContentHash(jpeg));
  });
});
