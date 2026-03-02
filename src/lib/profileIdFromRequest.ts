import { NextRequest } from 'next/server';
import { isProfileId } from './profiles';

const DEFAULT_PROFILE_ID = 1;

export function getProfileIdFromRequest(request: NextRequest): number {
  const header = request.headers.get('X-Profile-Id');
  if (header != null) {
    const n = parseInt(header, 10);
    if (isProfileId(n)) return n;
  }
  const q = request.nextUrl.searchParams.get('profileId');
  if (q != null) {
    const n = parseInt(q, 10);
    if (isProfileId(n)) return n;
  }
  return DEFAULT_PROFILE_ID;
}
