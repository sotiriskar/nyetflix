/**
 * Shared in-memory registry for video and subtitle file paths.
 * Both scan-library and stream-video import from here so the data
 * persists across route compilations in Next.js dev mode.
 *
 * Uses a global variable so the maps survive hot-reloads.
 * Persisted to data/stream-registry.json so after a server restart
 * playback still works (no "Rescan your library" for known items).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const globalKey = Symbol.for('nyetflix-stream-registry');
const REGISTRY_FILE = join(process.cwd(), 'data', 'stream-registry.json');

interface StreamRegistry {
  itemIdToPath: Map<string, string>;
  itemIdToSubtitlePath: Map<string, Record<string, string>>;
  /** For series: itemId -> folder path (so we can list seasons/episodes) */
  folderPathByItemId: Map<string, string>;
  /** Episode playback: episodeId -> video file path */
  episodeIdToPath: Map<string, string>;
  /** Episode subtitles: episodeId -> { langCode: filePath } */
  episodeIdToSubtitlePath: Map<string, Record<string, string>>;
}

function loadFromDisk(r: StreamRegistry): void {
  try {
    if (!existsSync(REGISTRY_FILE)) return;
    const raw = readFileSync(REGISTRY_FILE, 'utf-8');
    const data = JSON.parse(raw) as {
      itemIdToPath?: Record<string, string>;
      itemIdToSubtitlePath?: Record<string, Record<string, string>>;
      folderPathByItemId?: Record<string, string>;
      episodeIdToPath?: Record<string, string>;
      episodeIdToSubtitlePath?: Record<string, Record<string, string>>;
    };
    if (data.itemIdToPath) Object.entries(data.itemIdToPath).forEach(([k, v]) => r.itemIdToPath.set(k, v));
    if (data.itemIdToSubtitlePath) Object.entries(data.itemIdToSubtitlePath).forEach(([k, v]) => r.itemIdToSubtitlePath.set(k, v));
    if (data.folderPathByItemId) Object.entries(data.folderPathByItemId).forEach(([k, v]) => r.folderPathByItemId.set(k, v));
    if (data.episodeIdToPath) Object.entries(data.episodeIdToPath).forEach(([k, v]) => r.episodeIdToPath.set(k, v));
    if (data.episodeIdToSubtitlePath) Object.entries(data.episodeIdToSubtitlePath).forEach(([k, v]) => r.episodeIdToSubtitlePath.set(k, v));
  } catch {
    // ignore
  }
}

/** Ensure registry has data from disk when empty (e.g. stream-video runs in a different process/context than scan-library). */
export function ensureHydrated(): void {
  const r = getRegistry();
  if (r.itemIdToPath.size === 0) loadFromDisk(r);
}

/** Call after updating the registry (e.g. after scan-library) so playback works after server restart. */
export function persistRegistry(): void {
  const r = getRegistry();
  const dir = join(process.cwd(), 'data');
  try {
    mkdirSync(dir, { recursive: true });
    const obj = {
      itemIdToPath: Object.fromEntries(r.itemIdToPath),
      itemIdToSubtitlePath: Object.fromEntries(r.itemIdToSubtitlePath),
      folderPathByItemId: Object.fromEntries(r.folderPathByItemId),
      episodeIdToPath: Object.fromEntries(r.episodeIdToPath),
      episodeIdToSubtitlePath: Object.fromEntries(r.episodeIdToSubtitlePath),
    };
    writeFileSync(REGISTRY_FILE, JSON.stringify(obj), 'utf-8');
  } catch {
    // ignore
  }
}

function getRegistry(): StreamRegistry {
  const g = globalThis as unknown as Record<symbol, StreamRegistry>;
  let r = g[globalKey];
  if (!r) {
    r = {
      itemIdToPath: new Map(),
      itemIdToSubtitlePath: new Map(),
      folderPathByItemId: new Map(),
      episodeIdToPath: new Map(),
      episodeIdToSubtitlePath: new Map(),
    };
    g[globalKey] = r;
    loadFromDisk(r);
  } else {
    // Migrate older registry that may lack new maps (e.g. after deploy/hot-reload)
    if (!r.folderPathByItemId) r.folderPathByItemId = new Map();
    if (!r.episodeIdToPath) r.episodeIdToPath = new Map();
    if (!r.episodeIdToSubtitlePath) r.episodeIdToSubtitlePath = new Map();
  }
  return r;
}

export const registry = getRegistry();
