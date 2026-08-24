import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { registry, ensureHydrated } from '@/lib/streamRegistry';
import { getConvertedPath } from '@/lib/convertedMkvStore';
import { getFfmpegPath } from '@/lib/ffmpegPath';
import { getVideoExt, getVideoMimeType, DEFAULT_VIDEO_MIME } from '@/lib/videoMime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Returns the best playback URL for an item. MKV with ffmpeg → HLS (seek + correct duration). MP4 or converted → direct stream. */
export async function GET(request: NextRequest) {
  let id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }
  try {
    id = decodeURIComponent(id);
  } catch {
    // keep as-is if already decoded
  }

  ensureHydrated();
  const filePath = registry.itemIdToPath.get(id) ?? registry.episodeIdToPath.get(id);
  // After MKV conversion the refetch may hit a process where registry isn't populated; use converted path if present
  if (!filePath) {
    const converted = getConvertedPath(id);
    if (converted && existsSync(converted)) {
      return NextResponse.json({
        url: `${request.nextUrl.origin}/api/stream-video?id=${encodeURIComponent(id)}`,
        type: 'video',
        mimeType: DEFAULT_VIDEO_MIME,
        seekable: true,
      });
    }
    return NextResponse.json({ error: 'Unknown or expired item. Rescan the library.' }, { status: 404 });
  }

  const ext = getVideoExt(filePath);

  if (ext === '.mkv') {
    const converted = getConvertedPath(id);
    if (converted && existsSync(converted)) {
      return NextResponse.json({
        url: `${request.nextUrl.origin}/api/stream-video?id=${encodeURIComponent(id)}`,
        type: 'video',
        mimeType: getVideoMimeType(converted),
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
    mimeType: getVideoMimeType(filePath),
    seekable: true,
  });
}
