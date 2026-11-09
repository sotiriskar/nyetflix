import { NextRequest, NextResponse } from 'next/server';
import { pendingSignIns } from '@/lib/storage/oauthPending';
import { getProfileIdFromRequest } from '@/lib/profileIdFromRequest';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET ?state=… — how a sign-in is going. Never returns tokens. */
export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get('state') ?? '';
  const p = pendingSignIns().get(state);
  if (!p || p.profileId !== getProfileIdFromRequest(request)) {
    return NextResponse.json({ status: 'error', error: 'This sign-in expired. Click Sign in again.' });
  }
  return NextResponse.json({ status: p.status, provider: p.provider, account: p.account, error: p.error });
}
