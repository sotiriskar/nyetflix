import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import iconv from 'iconv-lite';
import { registry } from '@/lib/streamRegistry';
const itemIdToSubtitlePath = registry.itemIdToSubtitlePath;

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
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }
  try {
    id = decodeURIComponent(id);
  } catch {
    // keep as-is
  }

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
