import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, stat, existsSync } from 'fs';
import { promisify } from 'util';
import { Readable } from 'stream';
import { registry, ensureHydrated } from '@/lib/streamRegistry';
import { getConvertedPath } from '@/lib/convertedMkvStore';

const itemIdToPath = registry.itemIdToPath;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const statAsync = promisify(stat);

const MIME_BY_EXT: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/x-m4v',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
};

/** Formats we allow streaming. MKV is streamed as-is; we convert to MP4+AAC in background for future plays. */
const BROWSER_SAFE_EXT = new Set(['.mp4', '.m4v', '.webm', '.mov', '.mkv']);

function getMime(path: string): string {
  const ext = path.includes('.') ? path.slice(path.lastIndexOf('.')).toLowerCase() : '';
  return MIME_BY_EXT[ext] ?? 'video/mp4';
}

function getExt(path: string): string {
  return path.includes('.') ? path.slice(path.lastIndexOf('.')).toLowerCase() : '';
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  ensureHydrated();
  let filePath = itemIdToPath.get(id) ?? registry.episodeIdToPath.get(id);
  if (!filePath) {
    return NextResponse.json({ error: 'Unknown or expired item. Rescan the library.' }, { status: 404 });
  }

  const ext = getExt(filePath);

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
  const effectiveExtNow = getExt(filePath);
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

  const effectiveExt = getExt(filePath);
  if (!BROWSER_SAFE_EXT.has(effectiveExt)) {
    return NextResponse.json(
      { error: `Unsupported format .${effectiveExt.slice(1)}. Use MP4, MKV, or WebM.` },
      { status: 415 }
    );
  }

  const range = request.headers.get('range');
  const mime = getMime(filePath);

  if (!range || !range.startsWith('bytes=')) {
    const nodeStream = createReadStream(filePath);
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
