/**
 * Durable on-device scan queue for offline check-in.
 *
 * A scan is written to IndexedDB before any network attempt, so refreshing the page,
 * losing connectivity or closing the browser never loses an attendance record.
 * See docs/09-frontend-architecture.md (Offline check-in).
 */

export interface QueuedScan {
  id: string;
  eventId: string;
  badgeToken: string;
  scannedAt: string;
  syncedAt: string | null;
}

const DATABASE_NAME = 'ep-checkin';
const STORE_NAME = 'scans';
const DATABASE_VERSION = 1;

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('by_event', 'eventId', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return databasePromise;
}

function transaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, mode);
        const request = action(tx.objectStore(STORE_NAME));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export function createScan(eventId: string, badgeToken: string): QueuedScan {
  return {
    id: crypto.randomUUID(),
    eventId,
    badgeToken,
    scannedAt: new Date().toISOString(),
    syncedAt: null,
  };
}

export async function enqueueScan(scan: QueuedScan): Promise<void> {
  await transaction('readwrite', (store) => store.put(scan));
}

export function listPendingScans(eventId: string): Promise<QueuedScan[]> {
  return openDatabase().then(
    (database) =>
      new Promise<QueuedScan[]>((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, 'readonly');
        const index = tx.objectStore(STORE_NAME).index('by_event');
        const request = index.getAll(eventId);
        request.onsuccess = () => {
          const scans = (request.result as QueuedScan[]).filter(
            (scan) => scan.syncedAt === null,
          );
          resolve(scans.sort((a, b) => a.scannedAt.localeCompare(b.scannedAt)));
        };
        request.onerror = () => reject(request.error);
      }),
  );
}

export async function markSynced(scans: QueuedScan[]): Promise<void> {
  const syncedAt = new Date().toISOString();
  await Promise.all(
    scans.map((scan) =>
      transaction('readwrite', (store) => store.put({ ...scan, syncedAt })),
    ),
  );
}
