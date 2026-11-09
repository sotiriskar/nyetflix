/**
 * A tiny HTTP server, inside the Nyetflix process, that ffmpeg/ffprobe read from when a source
 * has no URL of its own they could open: Google Drive, OneDrive, Dropbox (need auth headers)
 * and SFTP (no ffmpeg support in most builds).
 *
 *   http://127.0.0.1:<random port>/<random token>/<encoded media path>/<file name>
 *
 * It listens on loopback only, every URL carries a random per-process token, and it serves
 * byte ranges with the real total size, which ffmpeg needs to seek and find an MP4's index.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { randomBytes } from 'crypto';
import { parseBytesRange } from '../byteRange';
import { formatRemotePath } from './mediaUri';

type ProxyState = { ready: Promise<{ port: number; token: string }> };
const key = Symbol.for('nyetflix-media-proxy');

async function handle(req: IncomingMessage, res: ServerResponse, token: string): Promise<void> {
  const parts = (req.url ?? '').split('/');
  // ['', token, encodedPath, fileName]
  if (parts[1] !== token || !parts[2] || (req.method !== 'GET' && req.method !== 'HEAD')) {
    res.writeHead(404).end();
    return;
  }
  let mediaPath: string;
  try {
    mediaPath = decodeURIComponent(parts[2]);
  } catch {
    res.writeHead(400).end();
    return;
  }
  const { mediaStat, openMediaStream } = await import('./index');
  const st = await mediaStat(mediaPath);
  if (!st || !st.isFile) {
    res.writeHead(404).end();
    return;
  }
  const size = st.size;
  const headers: Record<string, string | number> = { 'Accept-Ranges': 'bytes', 'Content-Type': 'application/octet-stream' };
  const rangeHeader = req.headers.range;
  const range = rangeHeader ? parseBytesRange(rangeHeader, size) : null;
  if (rangeHeader && !range) {
    res.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` }).end();
    return;
  }
  if (range) {
    res.writeHead(206, {
      ...headers,
      'Content-Length': range.end - range.start + 1,
      'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
    });
  } else {
    res.writeHead(200, { ...headers, 'Content-Length': size });
  }
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  const stream = await openMediaStream(mediaPath, range ? { start: range.start, end: range.end } : undefined);
  req.on('close', () => stream.destroy());
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

function state(): ProxyState {
  const g = globalThis as unknown as Record<symbol, ProxyState>;
  if (!g[key]) {
    const token = randomBytes(18).toString('hex');
    g[key] = {
      ready: new Promise((resolve, reject) => {
        const server = createServer((req, res) => {
          handle(req, res, token).catch(() => {
            if (!res.headersSent) res.writeHead(502);
            res.end();
          });
        });
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
          const addr = server.address();
          resolve({ port: typeof addr === 'object' && addr ? addr.port : 0, token });
        });
        // Never keep the process alive just for this.
        server.unref();
      }),
    };
  }
  return g[key];
}

/** URL ffmpeg can open for a file in a remote source. */
export async function proxyUrlFor(sourceId: string, key: string): Promise<string> {
  const { port, token } = await state().ready;
  const mediaPath = formatRemotePath(sourceId, key);
  const fileName = encodeURIComponent(key.split('/').pop() || 'media');
  return `http://127.0.0.1:${port}/${token}/${encodeURIComponent(mediaPath)}/${fileName}`;
}
