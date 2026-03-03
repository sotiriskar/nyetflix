/**
 * Persist FileSystemDirectoryHandle in IndexedDB for "Choose folder" mode.
 * Handles can be stored and survive page reloads; permission may need re-grant on load.
 */

const DB_NAME = 'nyetflix-library';
const DB_VERSION = 1;
const STORE_NAME = 'handles';

export type StoredHandle = {
  handle: FileSystemDirectoryHandle;
  profileId: number;
  storedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'profileId' });
    };
  });
}

export async function saveLibraryHandle(profileId: number, handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ profileId, handle, storedAt: Date.now() });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getLibraryHandle(profileId: number): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(profileId);
    req.onsuccess = () => {
      db.close();
      const row = req.result as StoredHandle | undefined;
      resolve(row?.handle ?? null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function removeLibraryHandle(profileId: number): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(profileId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/** Get a File from a directory handle using a relative path (e.g. "Movie1/movie.mp4"). */
export async function getFileFromHandle(
  handle: FileSystemDirectoryHandle,
  relativePath: string
): Promise<File> {
  const parts = relativePath.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length === 0) throw new Error('Empty path');
  if (parts.length === 1) {
    const fileHandle = await handle.getFileHandle(parts[0]!);
    return fileHandle.getFile();
  }
  let dir = handle;
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i]!);
  }
  const fileHandle = await dir.getFileHandle(parts[parts.length - 1]!);
  return fileHandle.getFile();
}
