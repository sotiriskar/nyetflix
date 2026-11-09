import { NextResponse } from 'next/server';
import { sep } from 'path';
import { findSyncFolders } from '@/lib/storage/syncFolders';
import { isProviderConfigured } from '@/lib/storage/oauth';
import { CLOUD_PROVIDERS } from '@/lib/storage/clientTypes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET — for each of Google Drive / OneDrive / Dropbox: whether Nyetflix can sign in to it
 * directly, and otherwise where that provider's desktop app keeps its folder on this computer.
 */
export async function GET() {
  const found = findSyncFolders();
  const providers = Object.fromEntries(
    CLOUD_PROVIDERS.map((p) => [p, { signIn: isProviderConfigured(p), ...found[p] }]),
  );
  return NextResponse.json({ sep, platform: process.platform, providers });
}
