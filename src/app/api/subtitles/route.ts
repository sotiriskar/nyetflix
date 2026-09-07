import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { spawn } from 'child_process';
import iconv from 'iconv-lite';
import { registry, ensureHydrated } from '@/lib/streamRegistry';
import { getFfmpegPath } from '@/lib/ffmpegPath';
import { findSidecarSubtitles } from '@/lib/sidecarSubtitles';
import { parseSubtitleKey } from '@/lib/subtitleTrackKeys';

const itemIdToSubtitlePath = registry.itemIdToSubtitlePath;

/** Original video path from registry (no converted fallback). Use for embedded stream extraction so we read from the file that has the subs. */
function getOriginalVideoPath(id: string): string | null {
  ensureHydrated();
  return registry.itemIdToPath.get(id) ?? registry.episodeIdToPath.get(id) ?? null;
}

/** Decode subtitle buffer as UTF-8, or for Greek try Windows-1253 / ISO-8859-7 if UTF-8 yields replacement chars. */
function decodeSubtitle(buffer: Buffer, lang: string): string {
  const utf8 = buffer.toString('utf-8');
  if (lang !== 'el') return utf8;
  if (!utf8.includes('\uFFFD')) return utf8;
  const win1253 = iconv.decode(buffer, 'win1253');
  if (!win1253.includes('\uFFFD')) return win1253;
  return iconv.decode(buffer, 'iso-8859-7');
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  let id = request.nextUrl.searchParams.get('id');
  const lang = request.nextUrl.searchParams.get('lang') ?? 'en';
  const streamParam = request.nextUrl.searchParams.get('stream');
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }
  try {
    id = decodeURIComponent(id);
  } catch {
    // keep as-is
  }

  // Embedded track: extract from original file (MKV) so we have the streams; converted MP4 often has none
  if (streamParam != null && streamParam !== '') {
    const streamIndex = parseInt(streamParam, 10);
    if (!Number.isInteger(streamIndex) || streamIndex < 0) {
      return NextResponse.json({ error: 'Invalid stream index' }, { status: 400 });
    }
    const videoPath = getOriginalVideoPath(id);
    if (!videoPath) {
      return NextResponse.json({ error: 'Unknown or expired item. Rescan the library.' }, { status: 404 });
    }
    const ffmpegBin = getFfmpegPath();
    const ffmpeg = spawn(
      ffmpegBin,
      [
        '-v',
        'quiet',
        '-y',
        '-i',
        videoPath,
        '-map',
        `0:${streamIndex}`,
        '-f',
        'webvtt',
        'pipe:1',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    const chunks: Buffer[] = [];
    ffmpeg.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk));
    ffmpeg.stderr?.on('data', () => {});
    const exit = await new Promise<number | null>((resolve) => {
      ffmpeg.on('close', resolve);
      ffmpeg.on('error', () => resolve(-1));
      setTimeout(() => {
        ffmpeg.kill('SIGKILL');
        resolve(null);
      }, 30000);
    });
    if (exit !== 0 && exit != null) {
      return NextResponse.json({ error: 'Could not extract embedded subtitles' }, { status: 500 });
    }
    const body = Buffer.concat(chunks);
    if (body.length === 0) {
      return NextResponse.json({ error: 'Empty subtitle stream' }, { status: 500 });
    }
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  // External subtitle file. `lang` is a track key: a language code, or `en.forced` style for
  // the extra tracks a file can hold in the same language.
  const byLang = itemIdToSubtitlePath.get(id) ?? registry.episodeIdToSubtitlePath.get(id);
  let filePath =
    typeof byLang === 'string'
      ? (lang === 'en' ? byLang : undefined)
      : (byLang && typeof byLang === 'object' ? byLang[lang] : undefined);
  // Registry may predate the file (fresh restart, or a rescan that only matched simple names),
  // or still point at a sidecar that was deleted with a previous conversion package.
  if (!filePath || !existsSync(filePath)) {
    const videoPath = getOriginalVideoPath(id);
    if (videoPath) {
      const onDisk = await findSidecarSubtitles(videoPath);
      filePath = onDisk[lang];
      // HLS marker deleted but MKV restored: look next to the MKV.
      if (!filePath && /\.m3u8$/i.test(videoPath)) {
        const mkv = join(dirname(videoPath), basename(videoPath).replace(/\.m3u8$/i, '.mkv'));
        filePath = (await findSidecarSubtitles(mkv))[lang];
      }
    }
  }
  if (!filePath) {
    return NextResponse.json({ error: 'No subtitles for this title' }, { status: 404 });
  }
  const baseLang = parseSubtitleKey(lang).lang;

  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  const isVtt = ext === '.vtt';

  try {
    const buffer = await readFile(filePath);
    const content = decodeSubtitle(buffer, baseLang);
    return new NextResponse(isVtt ? content : srtToVtt(content), {
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Subtitle file not found' }, { status: 404 });
  }
}

function srtToVtt(srt: string): string {
  const vtt = 'WEBVTT\n\n' + srt
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, '$1:$2:$3.$4');
  return vtt;
}
