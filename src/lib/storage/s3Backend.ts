import {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
  GetObjectCommand,
  type ListObjectsV2CommandOutput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'stream';
import type { S3SourceConfig, StorageBackend, MediaDirEntry, MediaStat, ByteRange } from './types';

/** ffmpeg conversions of a long remux can run for a while; the URL has to outlive them. */
const PRESIGN_SECONDS = 12 * 60 * 60;

function entry(name: string, dir: boolean, size?: number, mtimeMs?: number): MediaDirEntry {
  return { name, size, mtimeMs, isFile: () => !dir, isDirectory: () => dir };
}

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === 'NotFound' || e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404;
}

export function createS3Backend(cfg: S3SourceConfig): StorageBackend {
  const client = new S3Client({
    region: cfg.region || 'us-east-1',
    endpoint: cfg.endpoint || undefined,
    forcePathStyle: !!cfg.forcePathStyle,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    // Google Cloud Storage and several S3 clones reject the SDK's default CRC32 checksum headers.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  const Bucket = cfg.bucket;

  async function list(dirKey: string): Promise<MediaDirEntry[]> {
    const Prefix = dirKey ? `${dirKey}/` : '';
    const out: MediaDirEntry[] = [];
    let ContinuationToken: string | undefined;
    do {
      const res: ListObjectsV2CommandOutput = await client.send(
        new ListObjectsV2Command({ Bucket, Prefix, Delimiter: '/', ContinuationToken }),
      );
      for (const p of res.CommonPrefixes ?? []) {
        const name = (p.Prefix ?? '').slice(Prefix.length).replace(/\/$/, '');
        if (name) out.push(entry(name, true));
      }
      for (const o of res.Contents ?? []) {
        const name = (o.Key ?? '').slice(Prefix.length);
        // Skip the zero-byte "folder marker" objects some tools create.
        if (!name || name.includes('/')) continue;
        out.push(entry(name, false, o.Size ?? 0, o.LastModified?.getTime()));
      }
      ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (ContinuationToken);
    return out;
  }

  async function stat(key: string): Promise<MediaStat | null> {
    if (!key) return { isFile: false, isDirectory: true, size: 0 };
    try {
      const head = await client.send(new HeadObjectCommand({ Bucket, Key: key }));
      return {
        isFile: true,
        isDirectory: false,
        size: head.ContentLength ?? 0,
        mtimeMs: head.LastModified?.getTime(),
      };
    } catch (err) {
      if (!isNotFound(err)) throw err;
    }
    const res = await client.send(
      new ListObjectsV2Command({ Bucket, Prefix: `${key}/`, MaxKeys: 1 }),
    );
    return (res.KeyCount ?? 0) > 0 ? { isFile: false, isDirectory: true, size: 0 } : null;
  }

  async function createReadStream(key: string, range?: ByteRange): Promise<Readable> {
    const Range = range ? `bytes=${range.start}-${range.end ?? ''}` : undefined;
    const res = await client.send(new GetObjectCommand({ Bucket, Key: key, Range }));
    // In Node the SDK returns an http.IncomingMessage, which is a Readable.
    return res.Body as Readable;
  }

  async function readFile(key: string): Promise<Buffer> {
    const res = await client.send(new GetObjectCommand({ Bucket, Key: key }));
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }

  function inputUrl(key: string): Promise<string> {
    return getSignedUrl(client, new GetObjectCommand({ Bucket, Key: key }), { expiresIn: PRESIGN_SECONDS });
  }

  return { list, stat, createReadStream, readFile, inputUrl };
}
