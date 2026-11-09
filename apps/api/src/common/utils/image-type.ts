/**
 * Identifies an uploaded image by its leading bytes, never by the client-supplied
 * content type or file name. SVG is deliberately not accepted: it can carry scripts.
 */
export interface DetectedImage {
  extension: 'png' | 'jpg' | 'webp' | 'ico';
  contentType: string;
}

export function detectImageType(bytes: Uint8Array): DetectedImage | null {
  const at = (index: number): number => bytes[index] ?? -1;

  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) {
    return { extension: 'png', contentType: 'image/png' };
  }
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) {
    return { extension: 'jpg', contentType: 'image/jpeg' };
  }
  const riff = [0x52, 0x49, 0x46, 0x46].every((byte, i) => at(i) === byte);
  const webp = [0x57, 0x45, 0x42, 0x50].every((byte, i) => at(8 + i) === byte);
  if (riff && webp) {
    return { extension: 'webp', contentType: 'image/webp' };
  }
  if (at(0) === 0x00 && at(1) === 0x00 && at(2) === 0x01 && at(3) === 0x00) {
    return { extension: 'ico', contentType: 'image/x-icon' };
  }
  return null;
}
