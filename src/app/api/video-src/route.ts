import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { basename, dirname, join } from 'path';
import { registry, ensureHydrated, persistRegistry } from '@/lib/streamRegistry';
import { getConvertedPath, clearConvertedPath } from '@/lib/convertedMkvStore';
import { getFfmpegPath } from '@/lib/ffmpegPath';
import {
  getVideoExt,
  getVideoMimeType,
  DEFAULT_VIDEO_MIME,
  HLS_MARKER_EXT,
  HLS_MIME_TYPE,
} from '@/lib/videoMime';
import { isHlsMarkerPath, isHlsPackageComplete } from '@/lib/hlsPackage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Multi-audio MKVs are converted to an HLS package; the player needs its marker playlist. */
function hlsResponse(request: NextRequest, id: string) {
  return NextResponse.json({
    url: `${request.nextUrl.origin}/api/hls-file?id=${encodeURIComponent(id)}`,
    type: 'hls',
    mimeType: HLS_MIME_TYPE,
    seekable: true,
  });
}

function streamResponse(request: NextRequest, id: string, mimeType: string) {
  return NextResponse.json({
    url: `${request.nextUrl.origin}/api/stream-video?id=${encodeURIComponent(id)}`,
    type: 'video',
    mimeType,
    seekable: true,
  });
}

function needsConversionResponse(request: NextRequest, id: string) {
  const ffmpegBin = getFfmpegPath();
  if (/[\\/]/.test(ffmpegBin)) {
    return NextResponse.json({
      needsConversion: true,
      convertUrl: `${request.nextUrl.origin}/api/convert-mkv?id=${encodeURIComponent(id)}`,
    });
  }
  return NextResponse.json(
    { error: 'ffmpeg not found. Install ffmpeg to convert MKV for playback.' },
    { status: 503 },
  );
}

/** If an HLS marker is gone but the original MKV is back, retarget the registry at the MKV. */
function recoverMkvSibling(id: string, missingPath: string): string | null {
  if (!isHlsMarkerPath(missingPath)) return null;
  const mkv = join(dirname(missingPath), basename(missingPath).replace(/\.m3u8$/i, '.mkv'));
  if (!existsSync(mkv)) return null;
  clearConvertedPath(id);
  if (registry.episodeIdToPath.has(id)) registry.episodeIdToPath.set(id, mkv);
  else registry.itemIdToPath.set(id, mkv);
  persistRegistry();
  return mkv;
}

/** Returns the best playback URL for an item. MKV needs conversion first; everything else streams directly. */
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
  let filePath = registry.itemIdToPath.get(id) ?? registry.episodeIdToPath.get(id);

  // Registry may still point at a deleted HLS marker after the MKV was restored.
  if (filePath && !existsSync(filePath)) {
    const recovered = recoverMkvSibling(id, filePath);
    if (recovered) filePath = recovered;
  }

  // After MKV conversion the refetch may hit a process where registry isn't populated; use converted path if present
  if (!filePath) {
    const converted = getConvertedPath(id);
    if (converted && existsSync(converted)) {
      return getVideoExt(converted) === HLS_MARKER_EXT
        ? hlsResponse(request, id)
        : streamResponse(request, id, DEFAULT_VIDEO_MIME);
    }
    return NextResponse.json({ error: 'Unknown or expired item. Rescan the library.' }, { status: 404 });
  }

  const ext = getVideoExt(filePath);

  // A rescan finds the marker playlist itself, so this is the path for already-converted titles.
  if (ext === HLS_MARKER_EXT) {
    if (isHlsPackageComplete(filePath)) return hlsResponse(request, id);
    const recovered = recoverMkvSibling(id, filePath);
    if (recovered) return needsConversionResponse(request, id);
    return NextResponse.json(
      { error: 'This title is missing its converted files. Rescan the library.' },
      { status: 404 },
    );
  }

  if (ext === '.mkv') {
    const converted = getConvertedPath(id);
    if (converted && existsSync(converted)) {
      if (getVideoExt(converted) === HLS_MARKER_EXT) {
        if (isHlsPackageComplete(converted)) return hlsResponse(request, id);
        clearConvertedPath(id);
      } else {
        return streamResponse(request, id, getVideoMimeType(converted));
      }
    } else if (converted) {
      clearConvertedPath(id);
    }
    return needsConversionResponse(request, id);
  }

  return streamResponse(request, id, getVideoMimeType(filePath));
}
