import type { CheckInManifestEntry } from '@event-platform/shared';

/**
 * The downloaded attendee manifest: SHA-256 hashes of valid badge codes plus the display
 * name. It is all a device needs to validate a scan without a connection, and it never
 * contains the signing key. Kept in its own IndexedDB so the scan queue schema is untouched.
 */
const DB_NAME = 'ep-checkin-manifest';
const STORE = 'manifests';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'eventId' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface StoredManifest {
  eventId: string;
  savedAt: string;
  entries: CheckInManifestEntry[];
}

export async function saveManifest(eventId: string, entries: CheckInManifestEntry[]): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ eventId, savedAt: new Date().toISOString(), entries } satisfies StoredManifest);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadManifest(eventId: string): Promise<StoredManifest | null> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(eventId);
    request.onsuccess = () => resolve((request.result as StoredManifest | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
