import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { registry } from '@/lib/streamRegistry';
const itemIdToSubtitlePath = registry.itemIdToSubtitlePath;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  const lang = request.nextUrl.searchParams.get('lang') ?? 'en';
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
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
    const content = await readFile(filePath, 'utf-8');
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
