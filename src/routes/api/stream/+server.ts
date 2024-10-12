import type { RequestHandler } from '@sveltejs/kit';
import { Client } from 'minio';
import dotenv from 'dotenv';

dotenv.config();

const minioClient = new Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || '',
    secretKey: process.env.MINIO_SECRET_KEY || ''
});

export const GET: RequestHandler = async ({ url, request }) => {
  const movieId = url.searchParams.get('movie_id');

  if (!movieId) {
    return new Response('Movie ID is required', { status: 400 });
  }

  const range = request.headers.get('Range');
  let start = 0;
  let end = 0;
  let contentLength = 0;

  try {
    const stat = await minioClient.statObject('movies', `${movieId}/movie.mp4`);
    contentLength = stat.size;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      start = parseInt(parts[0], 10);
      end = parts[1] ? parseInt(parts[1], 10) : contentLength - 1;
    } else {
      end = contentLength - 1;
    }

    const stream = await minioClient.getPartialObject('movies', `${movieId}/movie.mp4`, start, end - start + 1);
    const readableStream = new ReadableStream({
      start(controller) {
        let closed = false;

        stream.on('data', (chunk) => {
          if (!closed) {
            try {
              controller.enqueue(chunk);
            } catch (err) {
              console.error('Error enqueuing chunk:', err);
              closed = true;
            }
          }
        });

        stream.on('end', () => {
          if (!closed) {
            console.log('Stream end event');
            controller.close();
            closed = true;
          }
        });

        stream.on('error', (err) => {
          if (!closed) {
            console.log('Stream error event:', err);
            controller.error(err);
            closed = true;
          }
        });

        stream.on('close', () => {
          closed = true;
        });
      },
      cancel() {
        stream.destroy();
      }
    });

    return new Response(readableStream, {
      status: range ? 206 : 200,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${contentLength}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': `${end - start + 1}`,
        'Content-Type': 'video/mp4'
      },
    });

  } catch (error) {
    console.error('Error fetching movie from MinIO:', error);
    return new Response('Error fetching movie', { status: 500 });
  }
}