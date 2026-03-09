import { NextRequest, NextResponse } from 'next/server';
import { registry, ensureHydrated } from '@/lib/streamRegistry';
import { getDurationSeconds } from '@/lib/ffprobeDuration';
import { getFfmpegPath } from '@/lib/ffmpegPath';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SEGMENT_DURATION = 6;

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
  const filePath = registry.itemIdToPath.get(id) ?? registry.episodeIdToPath.get(id);
  if (!filePath) {
    return NextResponse.json({ error: 'Unknown or expired item. Rescan the library.' }, { status: 404 });
  }

  const ext = filePath.includes('.') ? filePath.slice(filePath.lastIndexOf('.')).toLowerCase() : '';
  if (ext !== '.mkv') {
    return NextResponse.json({ error: 'HLS is only for MKV. Use stream-video for other formats.' }, { status: 400 });
  }

  const ffmpegBin = getFfmpegPath();
  if (!/[\\/]/.test(ffmpegBin)) {
    return NextResponse.json({ error: 'ffmpeg not found. Install ffmpeg for MKV playback.' }, { status: 503 });
  }

  const duration = await getDurationSeconds(filePath);
  if (duration == null || duration <= 0) {
    return NextResponse.json({ error: 'Could not read duration.' }, { status: 500 });
  }

  const numSegments = Math.ceil(duration / SEGMENT_DURATION);
  const baseUrl = request.nextUrl.origin + '/api/hls-segment';
  const lines: string[] = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '#EXT-X-TARGETDURATION:' + SEGMENT_DURATION,
    '#EXT-X-MEDIA-SEQUENCE:0',
    '#EXT-X-PLAYLIST-TYPE:VOD',
  ];

  for (let n = 0; n < numSegments; n++) {
    const segDuration = n < numSegments - 1 ? SEGMENT_DURATION : duration - (numSegments - 1) * SEGMENT_DURATION;
    lines.push(`#EXTINF:${segDuration.toFixed(3)},`);
    lines.push(`${baseUrl}?id=${encodeURIComponent(id)}&n=${n}`);
  }

  lines.push('#EXT-X-ENDLIST');
  const manifest = lines.join('\n');

  return new NextResponse(manifest, {
    headers: {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'no-store',
    },
  });
}
