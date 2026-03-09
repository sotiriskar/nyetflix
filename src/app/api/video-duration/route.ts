import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { registry, ensureHydrated } from '@/lib/streamRegistry';
import { getConvertedPath } from '@/lib/convertedMkvStore';
import { getFfmpegPath } from '@/lib/ffmpegPath';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Parse "Duration: 01:23:45.67" from ffmpeg stderr into seconds. */
function parseDuration(stderr: string): number | null {
  const m = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
  if (!m) return null;
  const [, h, min, sec, cent] = m;
  return parseInt(h!, 10) * 3600 + parseInt(min!, 10) * 60 + parseInt(sec!, 10) + parseInt(cent!, 10) / 100;
}

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
    return NextResponse.json({ error: 'Unknown or expired item. Rescan the library.' }, { status: 404 });
  }

  const ext = filePath.includes('.') ? filePath.slice(filePath.lastIndexOf('.')).toLowerCase() : '';
  if (ext === '.mkv') {
    const converted = getConvertedPath(id);
    if (converted && existsSync(converted)) filePath = converted;
  }

  const ffmpegBin = getFfmpegPath();
  let stderr: string;
  try {
    stderr = await new Promise<string>((resolve, reject) => {
      const proc = spawn(ffmpegBin, ['-i', filePath], { stdio: ['ignore', 'ignore', 'pipe'] });
      const chunks: string[] = [];
      proc.stderr?.setEncoding('utf-8');
      proc.stderr?.on('data', (chunk: string) => chunks.push(chunk));
      const done = (s: string) => {
        clearTimeout(t);
        resolve(s);
      };
      const t = setTimeout(() => {
        proc.kill('SIGKILL');
        done(chunks.join(''));
      }, 12000);
      proc.on('close', () => done(chunks.join('')));
      proc.on('error', reject);
    });
  } catch {
    return NextResponse.json({ error: 'Could not read duration.' }, { status: 500 });
  }
  const durationSeconds = parseDuration(stderr);
  if (durationSeconds == null || durationSeconds <= 0) {
    return NextResponse.json({ error: 'Could not read duration.' }, { status: 500 });
  }
  return NextResponse.json({ durationSeconds: Math.round(durationSeconds * 1000) / 1000 });
}
