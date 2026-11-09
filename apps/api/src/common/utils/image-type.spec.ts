import { describe, expect, it } from 'vitest';
import { detectImageType } from './image-type';

const bytes = (...values: number[]) => Uint8Array.from(values);

describe('detectImageType', () => {
  it('recognises PNG, JPEG, WebP and ICO from their signatures', () => {
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d))?.extension).toBe('png');
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))?.extension).toBe('jpg');
    expect(
      detectImageType(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))?.extension,
    ).toBe('webp');
    expect(detectImageType(bytes(0, 0, 1, 0, 1, 0))?.extension).toBe('ico');
  });

  it('rejects SVG and script content even if named like an image', () => {
    expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(detectImageType(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
  });

  it('rejects empty and truncated input', () => {
    expect(detectImageType(bytes())).toBeNull();
    expect(detectImageType(bytes(0x89, 0x50))).toBeNull();
  });
});
