/**
 * Library-wide app config (not per-profile). Conversion keep-source is global because
 * encodes run without a profile on the EventSource request.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'app-config.json');

export type AppConfig = {
  /** When true, leave the source .mkv next to the converted .mp4 / .m3u8. */
  keepSourceMkv: boolean;
};

const DEFAULTS: AppConfig = {
  keepSourceMkv: true,
};

const globalKey = Symbol.for('nyetflix-app-config');

function loadFromDisk(): AppConfig {
  try {
    if (!existsSync(FILE)) return { ...DEFAULTS };
    const raw = JSON.parse(readFileSync(FILE, 'utf-8')) as Partial<AppConfig>;
    return {
      keepSourceMkv: raw.keepSourceMkv !== false,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function getCached(): AppConfig {
  const g = globalThis as unknown as Record<symbol, AppConfig>;
  if (!g[globalKey]) g[globalKey] = loadFromDisk();
  return g[globalKey];
}

export function getAppConfig(): AppConfig {
  return { ...getCached() };
}

export function setAppConfig(partial: Partial<AppConfig>): AppConfig {
  const next: AppConfig = {
    ...getCached(),
    ...partial,
  };
  if (partial.keepSourceMkv !== undefined) next.keepSourceMkv = !!partial.keepSourceMkv;
  const g = globalThis as unknown as Record<symbol, AppConfig>;
  g[globalKey] = next;
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(next, null, 2), 'utf-8');
  } catch {
    // ignore persist errors
  }
  return { ...next };
}
