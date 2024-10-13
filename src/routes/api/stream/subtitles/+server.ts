import type { RequestHandler } from '@sveltejs/kit';
import { Client } from 'minio';
import dotenv from 'dotenv';
import { Readable } from 'stream';
import iconv from 'iconv-lite';

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
  const lang = url.searchParams.get('lang');

  if (!movieId || !lang) {
    return new Response('Movie ID and language are required', { status: 400 });
  }

  try {
    const subtitleStream = await minioClient.getObject('movies', `${movieId}/subtitles/${lang}.srt`);
    const subtitleText = await streamToString(subtitleStream, lang);
    const vttText = convertSrtToVtt(subtitleText);

    return new Response(vttText, {
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8'
      },
    });

  } catch (error) {
    console.error('Error fetching subtitle from MinIO:', error);
    return new Response('Error fetching subtitle', { status: 500 });
  }
};

// Helper function to convert stream to string with encoding support
async function streamToString(stream: Readable, lang: string): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  if (lang === 'gr') {
    let decodedText = iconv.decode(buffer, 'windows-1253');
    if (decodedText.includes('�')) {
      decodedText = buffer.toString('utf-8');
    }
    return decodedText;
  }

  // Default to UTF-8 for English and any other languages
  return buffer.toString('utf-8');
}

// Helper function to convert SRT to VTT
function convertSrtToVtt(srt: string): string {
  // Replace SRT timestamps with VTT timestamps
  const vtt = srt
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3}) --> (\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2 --> $3.$4')
    .replace(/^\d+\n/gm, '');
  return `WEBVTT\n\n${vtt}`;
}