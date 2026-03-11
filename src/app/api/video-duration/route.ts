import { NextRequest, NextResponse } from 'next/server';
import { getDurationSecondsForItem } from '@/lib/videoDuration';

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

  const durationSeconds = await getDurationSecondsForItem(id);
  if (durationSeconds == null || durationSeconds <= 0) {
    return NextResponse.json({ error: 'Unknown or expired item, or could not read duration. Rescan the library.' }, { status: 404 });
  }
  return NextResponse.json({ durationSeconds: Math.round(durationSeconds * 1000) / 1000 });
}
