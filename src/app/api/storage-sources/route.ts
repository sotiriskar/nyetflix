import { NextRequest, NextResponse } from 'next/server';
import {
  listSources,
  getProfileSource,
  saveSource,
  deleteSource,
  sourceFromInput,
  maskSource,
} from '@/lib/storage/sources';
import { getProfileIdFromRequest } from '@/lib/profileIdFromRequest';
import { getDb } from '@/lib/db';
import { discardSignIn } from '@/lib/storage/oauthPending';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET — this profile's media sources, secrets masked. */
export async function GET(request: NextRequest) {
  const profileId = getProfileIdFromRequest(request);
  return NextResponse.json({ sources: listSources(profileId).map(maskSource) });
}

/**
 * POST { ...source } — create, or update when `id` names one of this profile's sources.
 * A profile's first source becomes its library automatically.
 */
export async function POST(request: NextRequest) {
  try {
    const profileId = getProfileIdFromRequest(request);
    const body = (await request.json()) as Record<string, unknown>;
    const existing = typeof body.id === 'string' && body.id ? getProfileSource(profileId, body.id) : undefined;
    if (typeof body.id === 'string' && body.id && !existing) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }
    const saved = saveSource(sourceFromInput(body, profileId, existing));
    if (typeof body.oauthState === 'string') discardSignIn(body.oauthState);

    const db = getDb();
    const row = db
      .prepare('SELECT library_source_id FROM settings WHERE profile_id = ?')
      .get(profileId) as { library_source_id: string | null } | undefined;
    if (!row?.library_source_id || !getProfileSource(profileId, row.library_source_id)) {
      db.prepare(
        `INSERT INTO settings (profile_id, language, subtitle_language, movies_folder_path, library_source_id)
         VALUES (?, 'en', 'off', '', ?)
         ON CONFLICT(profile_id) DO UPDATE SET library_source_id = excluded.library_source_id`
      ).run(profileId, saved.id);
    }

    return NextResponse.json({ source: maskSource(saved) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}

/** DELETE ?id=… */
export async function DELETE(request: NextRequest) {
  const profileId = getProfileIdFromRequest(request);
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  if (!deleteSource(profileId, id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  getDb()
    .prepare('UPDATE settings SET library_source_id = NULL, movies_folder_path = ? WHERE profile_id = ? AND library_source_id = ?')
    .run('', profileId, id);
  return NextResponse.json({ ok: true });
}
