import { NextRequest, NextResponse } from 'next/server';
import { beginSignIn, PROVIDERS } from '@/lib/storage/oauth';
import { isProfileId } from '@/lib/profiles';
import type { CloudProvider } from '@/lib/storage/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function page(title: string, message: string, status = 400) {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title>` +
      `<body style="font-family:system-ui;background:#141414;color:#fff;padding:2rem;max-width:36rem">` +
      `<h2>${esc(title)}</h2><p style="color:#bbb;line-height:1.5">${esc(message)}</p></body>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

/**
 * GET ?provider=google|microsoft|dropbox&profileId=N[&json=1]
 * With json=1 (the source form): `{ url, state }`, so the form knows which sign-in to poll for.
 * Without: redirects straight to the provider's sign-in page.
 */
export async function GET(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get('provider') as CloudProvider | null;
  const asJson = request.nextUrl.searchParams.get('json') === '1';
  const profileId = Number(request.nextUrl.searchParams.get('profileId'));
  if (!provider || !(provider in PROVIDERS) || !isProfileId(profileId)) {
    if (asJson) return NextResponse.json({ error: 'Missing provider or profile.' }, { status: 400 });
    return page('Sign-in failed', 'Missing provider or profile.');
  }

  // Providers only send the browser back to localhost, so the sign-in has to start there.
  const host = request.headers.get('host') ?? '';
  const [hostname, port = ''] = host.replace(/^\[(.*)\](:\d+)?$/, '$1$2').split(/:(?=\d+$)/);
  if (!['localhost', '127.0.0.1', '::1'].includes(hostname ?? '')) {
    if (asJson) {
      return NextResponse.json(
        { error: `Connect accounts from the computer that runs Nyetflix (http://localhost${port ? `:${port}` : ''}).` },
        { status: 400 },
      );
    }
    return page(
      'Sign in from the Nyetflix computer',
      `Google, Microsoft and Dropbox only return to "localhost" after sign-in. Open http://localhost${port ? `:${port}` : ''} ` +
        'in a browser on the computer that runs Nyetflix and connect the account there. Once connected, it streams to every device.',
    );
  }

  try {
    const { url, state } = beginSignIn(provider, profileId, port);
    return asJson ? NextResponse.json({ url, state }) : NextResponse.redirect(url);
  } catch (e) {
    if (asJson) return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
    return page(`${PROVIDERS[provider].label} isn't set up`, e instanceof Error ? e.message : String(e));
  }
}
