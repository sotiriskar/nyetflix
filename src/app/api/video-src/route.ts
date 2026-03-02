import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { registry, ensureHydrated } from '@/lib/streamRegistry';
import { getConvertedPath } from '@/lib/convertedMkvStore';
import { getFfmpegPath } from '@/lib/ffmpegPath';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getExt(path: string): string {
  return path.includes('.') ? path.slice(path.lastIndexOf('.')).toLowerCase() : '';
}

/** Returns the best playback URL for an item. MKV with ffmpeg → HLS (seek + correct duration). MP4 or converted → direct stream. */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  ensureHydrated();
  const filePath = registry.itemIdToPath.get(id) ?? registry.episodeIdToPath.get(id);
  if (!filePath) {
    return NextResponse.json({ error: 'Unknown or expired item. Rescan the library.' }, { status: 404 });
  }

  const ext = getExt(filePath);

  if (ext === '.mkv') {
    const converted = getConvertedPath(id);
    if (converted && existsSync(converted)) {
      return NextResponse.json({
        url: `${request.nextUrl.origin}/api/stream-video?id=${encodeURIComponent(id)}`,
        type: 'video',
        seekable: true,
      });
    }
    // MKV must be converted to MP4 first; no live streaming
    const ffmpegBin = getFfmpegPath();
    if (/[\\/]/.test(ffmpegBin)) {
      return NextResponse.json({
        needsConversion: true,
        convertUrl: `${request.nextUrl.origin}/api/convert-mkv?id=${encodeURIComponent(id)}`,
      });
    }
    return NextResponse.json({ error: 'ffmpeg not found. Install ffmpeg to convert MKV for playback.' }, { status: 503 });
  }

  return NextResponse.json({
    url: `${request.nextUrl.origin}/api/stream-video?id=${encodeURIComponent(id)}`,
    type: 'video',
    seekable: true,
  });
}
