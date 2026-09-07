import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, stat } from 'fs';
import { promisify } from 'util';
import { Readable } from 'stream';
import { registry, ensureHydrated } from '@/lib/streamRegistry';
import { getConvertedPath } from '@/lib/convertedMkvStore';
import { getVideoExt, getVideoMimeType, HLS_MARKER_EXT } from '@/lib/videoMime';

const itemIdToPath = registry.itemIdToPath;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const statAsync = promisify(stat);

/** Formats we allow streaming. MKV is streamed as-is; we convert to MP4+AAC in background for future plays. */
const BROWSER_SAFE_EXT = new Set(['.mp4', '.m4v', '.webm', '.mov', '.mkv']);

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

  ensureHydrated();
  let filePath = itemIdToPath.get(id) ?? registry.episodeIdToPath.get(id);
  // After MKV conversion the request may hit a process where registry isn't populated; use converted path if present
  if (!filePath) {
    const converted = getConvertedPath(id);
    if (converted) {
      try {
        const st = await statAsync(converted);
        if (st.isFile()) filePath = converted;
      } catch {
        // ignore
      }
    }
  }
  if (!filePath) {
    return NextResponse.json({ error: 'Unknown or expired item. Rescan the library.' }, { status: 404 });
  }

  const ext = getVideoExt(filePath);

  // MKV: if we already have a converted MP4, stream that instead (so user gets sound).
  if (ext === '.mkv') {
    const converted = getConvertedPath(id);
    if (converted) {
      try {
        const st = await statAsync(converted);
        if (st.isFile()) {
          filePath = converted;
        }
      } catch {
        // converted path missing or invalid, fall back to MKV
      }
    }
  }

  // MKV with no converted file: must convert first via /api/convert-mkv
  const effectiveExtNow = getVideoExt(filePath);
  if (effectiveExtNow === '.mkv') {
    return NextResponse.json(
      { error: 'MKV must be converted first. Use /api/convert-mkv.' },
      { status: 503 }
    );
  }

  let size: number;
  try {
    const st = await statAsync(filePath);
    if (!st.isFile()) {
      return NextResponse.json({ error: 'Not a file' }, { status: 404 });
    }
    size = st.size;
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const effectiveExt = getVideoExt(filePath);
  // Multi-audio titles are HLS packages; those are served (and byte-ranged) by /api/hls-file.
  if (effectiveExt === HLS_MARKER_EXT) {
    return NextResponse.json(
      { error: 'This title streams as HLS. Use /api/hls-file.' },
      { status: 400 }
    );
  }
  if (!BROWSER_SAFE_EXT.has(effectiveExt)) {
    return NextResponse.json(
      { error: `Unsupported format .${effectiveExt.slice(1)}. Use MP4, MKV, or WebM.` },
      { status: 415 }
    );
  }

  const range = request.headers.get('range');
  const mime = getVideoMimeType(filePath);

  const onAbort = (nodeStream: ReturnType<typeof createReadStream>) => {
    if (!nodeStream.destroyed) nodeStream.destroy();
  };

  if (!range || !range.startsWith('bytes=')) {
    const nodeStream = createReadStream(filePath);
    request.signal?.addEventListener('abort', () => onAbort(nodeStream));
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
    return new Response(webStream, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Length': String(size),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
      },
    });
  }

  const parts = range.replace(/^bytes=/, '').split('-');
  const start = parts[0] ? parseInt(parts[0], 10) : 0;
  const rawEnd = parts[1] ? parseInt(parts[1], 10) : NaN;
  const end = Number.isNaN(rawEnd) ? size - 1 : rawEnd;
  const chunkStart = Math.min(Math.max(0, start), size - 1);
  const chunkEnd = Math.min(Math.max(chunkStart, end), size - 1);
  const chunkLength = chunkEnd - chunkStart + 1;

  const nodeStream = createReadStream(filePath, { start: chunkStart, end: chunkEnd });
  request.signal?.addEventListener('abort', () => onAbort(nodeStream));
  const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
  return new Response(webStream, {
    status: 206,
    headers: {
      'Content-Type': mime,
      'Content-Length': String(chunkLength),
      'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${chunkStart}-${chunkEnd}/${size}`,
      'Cache-Control': 'no-store',
    },
  });
}
