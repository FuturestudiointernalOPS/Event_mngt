import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Loads public/sw.js with a stub `self` and returns its pure helpers. */
function loadWorker(): { shouldCache: (url: string, origin: string) => boolean; isHashedAsset: (url: string, origin: string) => boolean } {
  const source = readFileSync(join(__dirname, '../../public/sw.js'), 'utf8');
  const stub = { addEventListener: () => undefined } as Record<string, unknown>;
  new Function('self', 'caches', source)(stub, {});
  return stub.__sw as ReturnType<typeof loadWorker>;
}

const ORIGIN = 'https://events.example.com';

describe('service worker caching rules', () => {
  const sw = loadWorker();

  it('never caches API calls or uploaded files, which may be private or change', () => {
    expect(sw.shouldCache(`${ORIGIN}/api/v1/participant/me`, ORIGIN)).toBe(false);
    expect(sw.shouldCache(`${ORIGIN}/static/org/logo.png`, ORIGIN)).toBe(false);
  });

  it('never caches another origin', () => {
    expect(sw.shouldCache('https://evil.example.org/app.js', ORIGIN)).toBe(false);
  });

  it('caches the app shell and treats /assets as immutable hashed files', () => {
    expect(sw.shouldCache(`${ORIGIN}/`, ORIGIN)).toBe(true);
    expect(sw.isHashedAsset(`${ORIGIN}/assets/index-abc123.js`, ORIGIN)).toBe(true);
    expect(sw.isHashedAsset(`${ORIGIN}/workspace/acme`, ORIGIN)).toBe(false);
  });
});
