import { NextResponse } from 'next/server';
import { PROVIDERS, isProviderConfigured } from '@/lib/storage/oauth';
import type { CloudProvider } from '@/lib/storage/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET — which "Sign in with …" buttons this server can offer, and the setting each one needs. */
export async function GET() {
  const out = Object.fromEntries(
    (Object.keys(PROVIDERS) as CloudProvider[]).map((p) => [
      p,
      { configured: isProviderConfigured(p), env: PROVIDERS[p].clientIdEnv },
    ]),
  );
  return NextResponse.json(out);
}
