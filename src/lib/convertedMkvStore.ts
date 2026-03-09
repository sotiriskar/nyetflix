/**
 * Persists which MKV items have been converted to MP4 (AAC).
 * Key = itemId, value = absolute path to the .mp4 file.
 * Used so we can stream the MP4 on future plays instead of the MKV.
 */

import { writeFile, mkdir } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const FILENAME = 'converted-mkv.json';
const dataDir = join(process.cwd(), 'data');
const filePath = join(dataDir, FILENAME);

const globalKey = Symbol.for('nyetflix-converted-mkv');
type Store = { map: Map<string, string>; inProgress: Set<string> };

function getStore(): Store {
  const g = globalThis as unknown as Record<symbol, Store>;
  let s = g[globalKey];
  if (!s) {
    s = { map: new Map(), inProgress: new Set() };
    g[globalKey] = s;
    try {
      if (existsSync(filePath)) {
        const raw = readFileSync(filePath, 'utf-8');
        const trimmed = typeof raw === 'string' ? raw.trim() : '';
        if (trimmed) {
          try {
            const obj = JSON.parse(trimmed) as Record<string, string>;
            if (obj && typeof obj === 'object') Object.entries(obj).forEach(([k, v]) => s!.map.set(k, v));
          } catch {
            // ignore corrupted or truncated JSON
          }
        }
      }
    } catch {
      // ignore
    }
    g[globalKey] = s;
  }
  return s;
}

async function save(): Promise<void> {
  const store = getStore();
  const obj: Record<string, string> = {};
  store.map.forEach((v, k) => { obj[k] = v; });
  try {
    await mkdir(dataDir, { recursive: true });
    await writeFile(filePath, JSON.stringify(obj, null, 0), 'utf-8');
  } catch {
    // ignore
  }
}

export function getConvertedPath(itemId: string): string | undefined {
  return getStore().map.get(itemId);
}

export function setConvertedPath(itemId: string, path: string): void {
  getStore().map.set(itemId, path);
  save();
}

/** Set converted path and wait for persistence. Call before sending "done" to client so playback can start. */
export async function setConvertedPathAndFlush(itemId: string, path: string): Promise<void> {
  getStore().map.set(itemId, path);
  await save();
}

export function isConversionInProgress(itemId: string): boolean {
  return getStore().inProgress.has(itemId);
}

/** True if any conversion is running (only one allowed at a time). */
export function hasAnyConversionInProgress(): boolean {
  return getStore().inProgress.size > 0;
}

export function markConversionStarted(itemId: string): void {
  getStore().inProgress.add(itemId);
}

export function markConversionFinished(itemId: string): void {
  getStore().inProgress.delete(itemId);
}

