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

export const GET: RequestHandler = async ({ url }) => {
  const movieId = url.searchParams.get('movie_id');

  if (!movieId) {
    return new Response('Movie ID is required', { status: 400 });
  }

  try {
    const stream = await minioClient.getObject('movies', `${movieId}/movie.mp4`);
    const readableStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err) => controller.error(err));
      }
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes'
      },
    });

  } catch (error) {
    console.error('Error fetching movie from MinIO:', error);
    return new Response('Error fetching movie', { status: 500 });
  }
};