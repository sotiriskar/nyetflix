import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, stat } from 'fs';
import { promisify } from 'util';
import { Readable } from 'stream';
import { registry, ensureHydrated } from '@/lib/streamRegistry';
import { getConvertedPath } from '@/lib/convertedMkvStore';
import { getVideoExt, getVideoMimeType, HLS_MARKER_EXT } from '@/lib/videoMime';
import { parseBytesRange } from '@/lib/byteRange';
import { MEDIA_CORS_HEADERS, mediaOptionsResponse } from '@/lib/mediaCors';

const itemIdToPath = registry.itemIdToPath;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const statAsync = promisify(stat);

/** Formats we allow streaming. MKV is streamed as-is; we convert to MP4+AAC in background for future plays. */
const BROWSER_SAFE_EXT = new Set(['.mp4', '.m4v', '.webm', '.mov', '.mkv']);

type ResolvedFile = { filePath: string; size: number; mime: string };

async function resolvePlayableFile(request: NextRequest): Promise<ResolvedFile | NextResponse> {
  let id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400, headers: MEDIA_CORS_HEADERS });
  }
  try {
    id = decodeURIComponent(id);
  } catch {
    // keep as-is
  }

  ensureHydrated();
  let filePath = itemIdToPath.get(id) ?? registry.episodeIdToPath.get(id);
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
    return NextResponse.json(
      { error: 'Unknown or expired item. Rescan the library.' },
      { status: 404, headers: MEDIA_CORS_HEADERS }
    );
  }

  const ext = getVideoExt(filePath);

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

  const effectiveExtNow = getVideoExt(filePath);
  if (effectiveExtNow === '.mkv') {
    return NextResponse.json(
      { error: 'MKV must be converted first. Use /api/convert-mkv.' },
      { status: 503, headers: MEDIA_CORS_HEADERS }
    );
  }

  let size: number;
  try {
    const st = await statAsync(filePath);
    if (!st.isFile()) {
      return NextResponse.json({ error: 'Not a file' }, { status: 404, headers: MEDIA_CORS_HEADERS });
    }
    size = st.size;
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404, headers: MEDIA_CORS_HEADERS });
  }

  const effectiveExt = getVideoExt(filePath);
  if (effectiveExt === HLS_MARKER_EXT) {
    return NextResponse.json(
      { error: 'This title streams as HLS. Use /api/hls-file.' },
      { status: 400, headers: MEDIA_CORS_HEADERS }
    );
  }
  if (!BROWSER_SAFE_EXT.has(effectiveExt)) {
    return NextResponse.json(
      { error: `Unsupported format .${effectiveExt.slice(1)}. Use MP4, MKV, or WebM.` },
      { status: 415, headers: MEDIA_CORS_HEADERS }
    );
  }

  return { filePath, size, mime: getVideoMimeType(filePath) };
}

function isResolvedFile(value: ResolvedFile | NextResponse): value is ResolvedFile {
  return !(value instanceof NextResponse);
}

export async function OPTIONS() {
  return mediaOptionsResponse();
}

/** Explicit HEAD so Next does not run GET and try to drain a multi-GB stream. */
export async function HEAD(request: NextRequest) {
  const resolved = await resolvePlayableFile(request);
  if (!isResolvedFile(resolved)) return resolved;
  return new Response(null, {
    status: 200,
    headers: {
      ...MEDIA_CORS_HEADERS,
      'Content-Type': resolved.mime,
      'Content-Length': String(resolved.size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(request: NextRequest) {
  const resolved = await resolvePlayableFile(request);
  if (!isResolvedFile(resolved)) return resolved;

  const { filePath, size, mime } = resolved;
  const range = request.headers.get('range');

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
        ...MEDIA_CORS_HEADERS,
        'Content-Type': mime,
        'Content-Length': String(size),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
      },
    });
  }

  const parsed = parseBytesRange(range, size);
  if (!parsed) {
    return new Response(null, {
      status: 416,
      headers: {
        ...MEDIA_CORS_HEADERS,
        'Content-Range': `bytes */${size}`,
        'Accept-Ranges': 'bytes',
      },
    });
  }
  const { start: chunkStart, end: chunkEnd } = parsed;
  const chunkLength = chunkEnd - chunkStart + 1;

  const nodeStream = createReadStream(filePath, { start: chunkStart, end: chunkEnd });
  request.signal?.addEventListener('abort', () => onAbort(nodeStream));
  const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
  return new Response(webStream, {
    status: 206,
    headers: {
      ...MEDIA_CORS_HEADERS,
      'Content-Type': mime,
      'Content-Length': String(chunkLength),
      'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${chunkStart}-${chunkEnd}/${size}`,
      'Cache-Control': 'no-store',
    },
  });
}
