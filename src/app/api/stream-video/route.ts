import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, stat } from 'fs';
import { promisify } from 'util';
import { Readable } from 'stream';
import { registry } from '@/lib/streamRegistry';
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

/** Browsers typically only play MP4/WebM/M4V/MOV natively. MKV/AVI often fail. */
const BROWSER_SAFE_EXT = new Set(['.mp4', '.m4v', '.webm', '.mov']);

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

  const filePath = itemIdToPath.get(id) ?? registry.episodeIdToPath.get(id);
  if (!filePath) {
    return NextResponse.json({ error: 'Unknown or expired item. Rescan the library.' }, { status: 404 });
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

  const ext = getExt(filePath);
  if (!BROWSER_SAFE_EXT.has(ext)) {
    return NextResponse.json(
      { error: `Browsers can't play .${ext.slice(1)} files. Use MP4 or WebM for best support.` },
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
