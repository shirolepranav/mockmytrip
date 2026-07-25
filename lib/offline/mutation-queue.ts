/*
 * Minimal IndexedDB-backed mutation queue (Phase 7 scaffold — TECH_SPEC §3
 * "offline-tolerant saves"). Queued mutations are generic {kind, payload}
 * records, replayed in FIFO order once the browser reconnects. No native
 * dependency; full background sync (a service worker draining this queue
 * even while the tab is closed) is Phase 8's job — this only handles the
 * "tab stayed open, connectivity blipped" case.
 */

const DB_NAME = "wanderlost-offline";
const DB_VERSION = 1;
const STORE_NAME = "mutation-queue";

export interface QueuedMutation {
  id?: number;
  kind: string;
  payload: unknown;
  queuedAt: number;
}

function openQueueDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queueMutation(kind: string, payload: unknown): Promise<void> {
  const db = await openQueueDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add({ kind, payload, queuedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listQueuedMutations(): Promise<QueuedMutation[]> {
  const db = await openQueueDb();
  const result = await new Promise<QueuedMutation[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as QueuedMutation[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

async function clearQueuedMutation(id: number): Promise<void> {
  const db = await openQueueDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/**
 * Replays every queued mutation in FIFO order via `replayFn`, clearing each
 * on success. Stops at the first failure (preserves ordering — the rest
 * retry on the next reconnect rather than replaying out of order).
 */
export async function drainQueue(
  replayFn: (mutation: QueuedMutation) => Promise<void>,
): Promise<void> {
  const mutations = await listQueuedMutations();
  mutations.sort((a, b) => a.queuedAt - b.queuedAt);
  for (const mutation of mutations) {
    try {
      await replayFn(mutation);
      if (mutation.id !== undefined) await clearQueuedMutation(mutation.id);
    } catch {
      break;
    }
  }
}
