/**
 * Shared in-memory registry for video and subtitle file paths.
 * Both scan-library and stream-video import from here so the data
 * persists across route compilations in Next.js dev mode.
 *
 * Uses a global variable so the maps survive hot-reloads.
 */

const globalKey = Symbol.for('nyetflix-stream-registry');

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
  } else {
    // Migrate older registry that may lack new maps (e.g. after deploy/hot-reload)
    if (!r.folderPathByItemId) r.folderPathByItemId = new Map();
    if (!r.episodeIdToPath) r.episodeIdToPath = new Map();
    if (!r.episodeIdToSubtitlePath) r.episodeIdToSubtitlePath = new Map();
  }
  return r;
}

export const registry = getRegistry();
