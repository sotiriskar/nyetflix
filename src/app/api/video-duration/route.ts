import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { registry, ensureHydrated } from '@/lib/streamRegistry';
import { getConvertedPath } from '@/lib/convertedMkvStore';
import { getDurationSecondsFromFile } from '@/lib/videoDuration';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
  if (!filePath) {
    const converted = getConvertedPath(id);
    if (converted && existsSync(converted)) filePath = converted;
  }
  if (!filePath) {
    return NextResponse.json({ error: 'Unknown or expired item. Rescan the library.' }, { status: 404 });
  }

  const ext = filePath.includes('.') ? filePath.slice(filePath.lastIndexOf('.')).toLowerCase() : '';
  if (ext === '.mkv') {
    const converted = getConvertedPath(id);
    if (converted && existsSync(converted)) filePath = converted;
  }

  const durationSeconds = await getDurationSecondsFromFile(filePath);
  if (durationSeconds == null || durationSeconds <= 0) {
    return NextResponse.json({ error: 'Could not read duration.' }, { status: 500 });
  }
  return NextResponse.json({ durationSeconds: Math.round(durationSeconds * 1000) / 1000 });
}
