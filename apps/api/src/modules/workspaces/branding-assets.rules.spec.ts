import { describe, expect, it } from 'vitest';
import { imageContentHash } from '../../common/uploads/image-upload.rules';
import { brandingAssetKey } from './branding-assets.rules';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);

describe('brandingAssetKey', () => {
  it('is content-addressed: the same bytes produce the same key', () => {
    const hash = imageContentHash(png);

    expect(brandingAssetKey('org-1', 'logo', hash, 'png')).toBe(
      brandingAssetKey('org-1', 'logo', imageContentHash(Buffer.from(png)), 'png'),
    );
  });

  it('changes when the bytes or the organisation change', () => {
    const first = brandingAssetKey('org-1', 'logo', imageContentHash(png), 'png');
    const second = brandingAssetKey('org-1', 'logo', imageContentHash(jpeg), 'jpeg');
    const otherTenant = brandingAssetKey('org-2', 'logo', imageContentHash(png), 'png');

    expect(first).not.toBe(second);
    expect(first).not.toBe(otherTenant);
    expect(first).toBe('org-1/branding/logo-' + imageContentHash(png) + '.png');
  });
});
