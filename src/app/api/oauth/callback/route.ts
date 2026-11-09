import { NextRequest, NextResponse } from 'next/server';
import { completeSignIn } from '@/lib/storage/oauth';
import { pendingSignIns } from '@/lib/storage/oauthPending';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET ?code&state (or ?error) — where Google / Microsoft / Dropbox send the browser back.
 * Stores the tokens server-side; the source form, which is polling /api/oauth/result,
 * picks up the account. This page just says so and closes itself.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const state = q.get('state') ?? '';
  let ok = false;
  let message: string;
  try {
    await completeSignIn(state, q.get('code'), q.get('error_description') || q.get('error'));
    const p = pendingSignIns().get(state);
    ok = p?.status === 'done';
    message = ok ? `Connected as ${p?.account}. You can close this window.` : p?.error ?? 'Sign-in failed.';
  } catch (e) {
    message = e instanceof Error ? e.message : String(e);
  }
  const esc = message.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>${ok ? 'Connected' : 'Sign-in failed'}</title>` +
      `<body style="font-family:system-ui;background:#141414;color:#fff;padding:2rem">` +
      `<h2>${ok ? 'Connected to Nyetflix' : 'Sign-in failed'}</h2><p style="color:#bbb">${esc}</p>` +
      (ok ? '<script>setTimeout(function(){window.close()},1200)</script>' : '') +
      '</body>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}
