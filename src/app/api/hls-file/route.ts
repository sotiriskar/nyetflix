import { NextRequest, NextResponse } from 'next/server';
import { createReadStream } from 'fs';
import { readFile, realpath, stat } from 'fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'path';
import { Readable } from 'stream';
import { registry, ensureHydrated } from '@/lib/streamRegistry';
import { getConvertedPath } from '@/lib/convertedMkvStore';
import { dataDirFor, isHlsMarkerPath } from '@/lib/hlsPackage';
import { HLS_MIME_TYPE } from '@/lib/videoMime';
import { parseBytesRange } from '@/lib/byteRange';
import { MEDIA_CORS_HEADERS, mediaOptionsResponse } from '@/lib/mediaCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Serves an HLS package (see hlsPackage.ts): the marker playlist, the rendition playlists
 * and their fMP4 data files.
 *
 * Playlists are rewritten on the way out so every URI becomes a request back to this route.
 * They can't be served verbatim: a relative URI inside `/api/hls-file?f=…` would resolve
 * against `/api/`, not against the folder the playlist lives in. The rewritten URIs stay
 * root-relative so a Google Cast receiver resolves them against the LAN address it fetched
 * the playlist from.
 */

const PLAYLIST_EXTS = new Set(['.m3u8', '.hlsp']);
const DATA_EXTS = new Set(['.m4s', '.mp4']);

function extensionOf(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot >= 0 ? path.slice(dot).toLowerCase() : '';
}

/** The item's marker playlist, whether the library points at it directly or it came from a conversion. */
function findMarkerPath(id: string): string | null {
  ensureHydrated();
  const registered = registry.itemIdToPath.get(id) ?? registry.episodeIdToPath.get(id);
  if (registered && isHlsMarkerPath(registered)) return registered;
  const converted = getConvertedPath(id);
  return converted && isHlsMarkerPath(converted) ? converted : null;
}

/** Validates a user-provided playlist/data relative path. */
function isSafeRelativeRequestPath(input: string): boolean {
  if (!input) return false;
  if (input.includes('\0')) return false;

  const normalized = input.replace(/\\/g, '/');
  if (normalized.startsWith('/')) return false;
  if (/^[A-Za-z]:\//.test(normalized)) return false;

  const parts = normalized.split('/');
  if (parts.some((p) => p.length === 0 || p === '.' || p === '..')) return false;

  return parts.every((p) => /^[A-Za-z0-9._-]+$/.test(p));
}

/** Joins a playlist-relative URI onto a folder, keeping the result inside it. */
function resolveWithin(baseDir: string, relativePath: string): string | null {
  const target = resolve(join(baseDir, relativePath));
  const root = resolve(baseDir);
  if (target !== root && !target.startsWith(root + sep)) return null;
  return target;
}

/** Forward-slash path of `target` relative to the marker's folder, for use as the `f` parameter. */
function toRequestPath(baseDir: string, target: string): string {
  return relative(baseDir, target).split(sep).join('/');
}

function playlistUrl(id: string, requestPath: string): string {
  return `/api/hls-file?id=${encodeURIComponent(id)}&f=${encodeURIComponent(requestPath)}`;
}

/** Rewrites every URI in a playlist — both bare lines and `URI="…"` attributes. */
function rewritePlaylist(body: string, id: string, baseDir: string, playlistDir: string): string {
  const rewriteUri = (uri: string): string => {
    if (/^[a-z]+:\/\//i.test(uri) || uri.startsWith('/')) return uri;
    const target = resolveWithin(playlistDir, uri);
    if (!target) return uri;
    return playlistUrl(id, toRequestPath(baseDir, target));
  };

  return body
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => {
      if (line.startsWith('#')) {
        return line.replace(/URI="([^"]*)"/g, (_match, uri: string) => `URI="${rewriteUri(uri)}"`);
      }
      const trimmed = line.trim();
      return trimmed === '' ? line : rewriteUri(trimmed);
    })
    .join('\n');
}

function rangeResponse(filePath: string, size: number, range: string | null, request: NextRequest) {
  const headers: Record<string, string> = {
    ...MEDIA_CORS_HEADERS,
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    // Segments never change once written, so let the browser reuse them while seeking.
    'Cache-Control': 'public, max-age=86400',
  };

  const openStream = (start?: number, end?: number) => {
    const nodeStream =
      start == null ? createReadStream(filePath) : createReadStream(filePath, { start, end });
    request.signal?.addEventListener('abort', () => {
      if (!nodeStream.destroyed) nodeStream.destroy();
    });
    return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
  };

  if (!range || !range.startsWith('bytes=')) {
    return new Response(openStream(), {
      status: 200,
      headers: { ...headers, 'Content-Length': String(size) },
    });
  }

  const parsed = parseBytesRange(range, size);
  if (!parsed) {
    return new Response(null, {
      status: 416,
      headers: { ...headers, 'Content-Range': `bytes */${size}` },
    });
  }
  const { start, end: safeEnd } = parsed;

  return new Response(openStream(start, safeEnd), {
    status: 206,
    headers: {
      ...headers,
      'Content-Length': String(safeEnd - start + 1),
      'Content-Range': `bytes ${start}-${safeEnd}/${size}`,
    },
  });
}

export async function OPTIONS() {
  return mediaOptionsResponse();
}

export async function GET(request: NextRequest) {
  let id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }
  try {
    id = decodeURIComponent(id);
  } catch {
    // keep as-is
  }

  const markerPath = findMarkerPath(id);
  if (!markerPath) {
    return NextResponse.json({ error: 'Unknown or expired item. Rescan the library.' }, { status: 404 });
  }

  const baseDir = dirname(markerPath);
  const requestedPath = request.nextUrl.searchParams.get('f') || basename(markerPath);
  if (!isSafeRelativeRequestPath(requestedPath)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }
  const filePath = resolveWithin(baseDir, requestedPath);
  if (!filePath) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  let realFilePath: string;
  let realMarkerPath: string;
  let realDataDir: string;
  try {
    realFilePath = await realpath(filePath);
    realMarkerPath = await realpath(markerPath);
    realDataDir = await realpath(dataDirFor(markerPath));
  } catch {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  // Only the marker and the files inside its own data folder are readable through here.
  const isMarker = realFilePath === realMarkerPath;
  if (!isMarker && !realFilePath.startsWith(realDataDir + sep)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const ext = extensionOf(realFilePath);
  if (!PLAYLIST_EXTS.has(ext) && !DATA_EXTS.has(ext)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  let size: number;
  try {
    const st = await stat(realFilePath);
    if (!st.isFile()) return NextResponse.json({ error: 'Not a file' }, { status: 404 });
    size = st.size;
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  if (PLAYLIST_EXTS.has(ext)) {
    const body = await readFile(realFilePath, 'utf-8');
    return new NextResponse(rewritePlaylist(body, id, baseDir, dirname(realFilePath)), {
      headers: {
        ...MEDIA_CORS_HEADERS,
        'Content-Type': HLS_MIME_TYPE,
        'Cache-Control': 'no-store',
      },
    });
  }

  return rangeResponse(realFilePath, size, request.headers.get('range'), request);
}
