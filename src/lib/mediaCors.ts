/** CORS + range headers browsers need when the player (or a Cast TV) is not on localhost. */
export const MEDIA_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
  'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Length, Content-Range, Content-Type',
};

export function mediaOptionsResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      ...MEDIA_CORS_HEADERS,
      'Access-Control-Max-Age': '86400',
    },
  });
}
