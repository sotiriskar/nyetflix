import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { Readable } from 'stream';
import { registry, ensureHydrated } from '@/lib/streamRegistry';
import { getConvertedPath } from '@/lib/convertedMkvStore';
import { getFfmpegPath } from '@/lib/ffmpegPath';
import { existsSync } from 'fs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SEGMENT_DURATION = 6;

function getExt(path: string): string {
  return path.includes('.') ? path.slice(path.lastIndexOf('.')).toLowerCase() : '';
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  const nParam = request.nextUrl.searchParams.get('n');
  if (!id || nParam == null) {
    return NextResponse.json({ error: 'Missing id or n' }, { status: 400 });
  }

  const n = parseInt(nParam, 10);
  if (!Number.isInteger(n) || n < 0) {
    return NextResponse.json({ error: 'Invalid segment index' }, { status: 400 });
  }

  ensureHydrated();
  let filePath = registry.itemIdToPath.get(id) ?? registry.episodeIdToPath.get(id);
  if (!filePath) {
    return NextResponse.json({ error: 'Unknown or expired item. Rescan the library.' }, { status: 404 });
  }

  const ext = getExt(filePath);
  if (ext === '.mkv') {
    const converted = getConvertedPath(id);
    if (converted && existsSync(converted)) filePath = converted;
  }

  const ffmpegBin = getFfmpegPath();
  const startTime = n * SEGMENT_DURATION;

  const ffmpeg = spawn(
    ffmpegBin,
    [
      '-ss', String(startTime),
      '-i', filePath,
      '-t', String(SEGMENT_DURATION),
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-threads', '0',
      '-f', 'mpegts',
      'pipe:1',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  const nodeStream = ffmpeg.stdout!;
  const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
  ffmpeg.stderr?.on('data', () => {});

  return new Response(webStream, {
    headers: {
      'Content-Type': 'video/MP2T',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
