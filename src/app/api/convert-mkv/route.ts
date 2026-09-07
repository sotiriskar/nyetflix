import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { basename, dirname, join } from 'path';
import { registry, ensureHydrated, persistRegistry } from '@/lib/streamRegistry';
import { getConvertedPath, clearConvertedPath } from '@/lib/convertedMkvStore';
import { getFfmpegPath } from '@/lib/ffmpegPath';
import { runMkvConversion, subscribeToProgress } from '@/lib/mkvConversionRunner';
import { isHlsMarkerPath } from '@/lib/hlsPackage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getExt(path: string): string {
  return path.includes('.') ? path.slice(path.lastIndexOf('.')).toLowerCase() : '';
}

async function getDurationSecondsWithError(filePath: string): Promise<{ duration: number; error?: string }> {
  const ffmpegBin = getFfmpegPath();
  const stderr = await new Promise<string>((resolve, reject) => {
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
    }, 15000);
    proc.on('close', () => done(chunks.join('')));
    proc.on('error', (e) => reject(e));
  });
  const m = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
  if (!m) {
    const snippet = stderr.trim().slice(-500).replace(/\s+/g, ' ') || 'No ffmpeg output';
    return { duration: 0, error: `Could not read duration. ${snippet}` };
  }
  const [, h, min, sec, cent] = m;
  const duration = parseInt(h!, 10) * 3600 + parseInt(min!, 10) * 60 + parseInt(sec!, 10) + parseInt(cent!, 10) / 100;
  return { duration };
}

export async function GET(request: NextRequest) {
  let id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400 });
  }
  try {
    id = decodeURIComponent(id);
  } catch {
    // keep as-is
  }

  ensureHydrated();
  let filePath = registry.itemIdToPath.get(id) ?? registry.episodeIdToPath.get(id);
  // Registry may still point at a deleted HLS marker after the MKV was restored.
  if (filePath && (!existsSync(filePath) || isHlsMarkerPath(filePath))) {
    const mkv = join(
      dirname(filePath),
      basename(filePath).replace(/\.(m3u8|mkv)$/i, '.mkv'),
    );
    if (existsSync(mkv)) {
      clearConvertedPath(id);
      if (registry.episodeIdToPath.has(id)) registry.episodeIdToPath.set(id, mkv);
      else registry.itemIdToPath.set(id, mkv);
      persistRegistry();
      filePath = mkv;
    }
  }
  if (!filePath || getExt(filePath) !== '.mkv' || !existsSync(filePath)) {
    return new Response(JSON.stringify({ error: 'Unknown or not MKV' }), { status: 404 });
  }

  const converted = getConvertedPath(id);
  if (converted && existsSync(converted)) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  const ffmpegBin = getFfmpegPath();
  if (!/[\\/]/.test(ffmpegBin)) {
    return new Response(JSON.stringify({ error: 'ffmpeg not found' }), { status: 503 });
  }

  const { duration: durationSeconds, error: durationError } = await getDurationSecondsWithError(filePath);
  if (durationSeconds <= 0) {
    return new Response(JSON.stringify({ error: durationError || 'Could not get duration' }), { status: 500 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const unsub = subscribeToProgress(id, (p) => {
        send({
          progress: p.progress,
          currentTime: p.currentTime,
          durationSeconds: p.durationSeconds,
          etaSeconds: p.etaSeconds,
        });
      });

      try {
        await runMkvConversion(id, filePath, durationSeconds, request.signal);
        send({ done: true });
      } catch (err) {
        send({ error: String(err) });
      } finally {
        unsub();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
