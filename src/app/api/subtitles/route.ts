import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { spawn } from 'child_process';
import iconv from 'iconv-lite';
import { registry, ensureHydrated } from '@/lib/streamRegistry';
import { getConvertedPath } from '@/lib/convertedMkvStore';
import { getFfmpegPath } from '@/lib/ffmpegPath';
import { stat } from 'fs';
import { promisify } from 'util';

const itemIdToSubtitlePath = registry.itemIdToSubtitlePath;
const statAsync = promisify(stat);

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

/** Resolve video file path for an item or episode id (including converted MKV). */
async function getVideoPath(id: string): Promise<string | null> {
  ensureHydrated();
  let filePath = registry.itemIdToPath.get(id) ?? registry.episodeIdToPath.get(id);
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
  return filePath ?? null;
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

  // External subtitle file
  const byLang = itemIdToSubtitlePath.get(id) ?? registry.episodeIdToSubtitlePath.get(id);
  const filePath =
    typeof byLang === 'string'
      ? (lang === 'en' ? byLang : undefined)
      : (byLang && typeof byLang === 'object' ? byLang[lang] : undefined);
  if (!filePath) {
    return NextResponse.json({ error: 'No subtitles for this title' }, { status: 404 });
  }

  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  const isVtt = ext === '.vtt';

  try {
    const buffer = await readFile(filePath);
    const content = decodeSubtitle(buffer, lang);
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
