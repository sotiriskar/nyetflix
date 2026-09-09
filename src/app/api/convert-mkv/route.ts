import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { basename, dirname, join } from 'path';
import { registry, ensureHydrated, persistRegistry } from '@/lib/streamRegistry';
import { getConvertedPath, clearConvertedPath, isDistinctConvertedOutput } from '@/lib/convertedMkvStore';
import { getFfmpegPath } from '@/lib/ffmpegPath';
import { runMkvConversion, subscribeToProgress } from '@/lib/mkvConversionRunner';
import { isHlsMarkerPath, isHlsPackageComplete } from '@/lib/hlsPackage';
import { MEDIA_CORS_HEADERS } from '@/lib/mediaCors';

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
  const ext = filePath ? getExt(filePath) : '';
  const CONVERTIBLE = new Set(['.mkv', '.mp4', '.m4v', '.mov']);
  if (!filePath || !CONVERTIBLE.has(ext) || !existsSync(filePath)) {
    return new Response(JSON.stringify({ error: 'Unknown or unsupported source file' }), { status: 404 });
  }

  if (isDistinctConvertedOutput(id, filePath)) {
    const converted = getConvertedPath(id)!;
    if (!isHlsMarkerPath(converted) || isHlsPackageComplete(converted)) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
        },
      });
      return new Response(stream, {
        headers: {
          ...MEDIA_CORS_HEADERS,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }
  }

  const ffmpegBin = getFfmpegPath();
  if (!/[\\/]/.test(ffmpegBin)) {
    return new Response(JSON.stringify({ error: 'ffmpeg not found' }), { status: 503 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // The client may already be gone (page closed); enqueueing then throws.
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // nothing to report to
        }
      };

      // Flush headers + a 0% tick immediately so EventSource doesn't hang during ffprobe.
      send({ progress: 0, currentTime: 0, durationSeconds: 0 });

      const { duration: durationSeconds, error: durationError } = await getDurationSecondsWithError(filePath);
      if (durationSeconds <= 0) {
        send({ error: durationError || 'Could not get duration' });
        try {
          controller.close();
        } catch {
          /* ignore */
        }
        return;
      }

      const unsub = subscribeToProgress(id, (p) => {
        send({
          progress: p.progress,
          currentTime: p.currentTime,
          durationSeconds: p.durationSeconds,
          etaSeconds: p.etaSeconds,
        });
      });

      try {
        // Do not pass request.signal: React Strict Mode / player remounts close the EventSource
        // and would abort ffmpeg mid-encode, freezing the UI at 0%. Conversion runs to completion;
        // a fresh EventSource rejoins via subscribeToProgress + the shared in-flight promise.
        await runMkvConversion(id, filePath, durationSeconds, null);
        send({ done: true });
      } catch (err) {
        send({ error: String(err) });
      } finally {
        unsub();
        try {
          controller.close();
        } catch {
          // already closed by the client disconnecting
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...MEDIA_CORS_HEADERS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
