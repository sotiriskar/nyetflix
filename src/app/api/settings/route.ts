import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getProfileIdFromRequest } from '@/lib/profileIdFromRequest';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SettingsRow = {
  language: string | null;
  subtitle_language: string | null;
  movies_folder_path: string | null;
};

type SettingsState = {
  language: 'en' | 'el';
  subtitleLanguage: 'off' | 'en' | 'el';
  moviesFolderPath: string;
};

function parseSubtitleLanguage(v: string | null): 'off' | 'en' | 'el' {
  if (v === 'off' || v === 'el') return v;
  if (v === 'en') return 'en';
  return 'off'; // null/empty/unknown → off
}

function rowToJson(row: SettingsRow | undefined): SettingsState & { saved: boolean } {
  const state: SettingsState = !row
    ? { language: 'en', subtitleLanguage: 'off', moviesFolderPath: '' }
    : {
        language: row.language === 'el' ? 'el' : 'en',
        subtitleLanguage: parseSubtitleLanguage(row.subtitle_language),
        moviesFolderPath: row.movies_folder_path ?? '',
      };
  return { ...state, saved: !!row };
}

export async function GET(request: NextRequest) {
  try {
    const profileId = getProfileIdFromRequest(request);
    const database = getDb();
    const row = database
      .prepare('SELECT language, subtitle_language, movies_folder_path FROM settings WHERE profile_id = ?')
      .get(profileId) as SettingsRow | undefined;
    return NextResponse.json(rowToJson(row));
  } catch (e) {
    console.error('settings GET', e);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const profileId = getProfileIdFromRequest(request);
    const body = (await request.json()) as Record<string, unknown>;
    const database = getDb();

    const current = database
      .prepare('SELECT language, subtitle_language, movies_folder_path FROM settings WHERE profile_id = ?')
      .get(profileId) as SettingsRow | undefined;

    const cur = rowToJson(current);
    const language = body.language !== undefined ? (body.language === 'el' ? 'el' : 'en') : cur.language;
    const subtitleLanguage = body.subtitleLanguage !== undefined ? parseSubtitleLanguage(String(body.subtitleLanguage)) : cur.subtitleLanguage;
    const moviesFolderPath = body.moviesFolderPath !== undefined ? String(body.moviesFolderPath) : cur.moviesFolderPath;

    database
      .prepare(
        `INSERT INTO settings (profile_id, language, subtitle_language, movies_folder_path)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(profile_id) DO UPDATE SET
           language = excluded.language,
           subtitle_language = excluded.subtitle_language,
           movies_folder_path = excluded.movies_folder_path`
      )
      .run(profileId, language, subtitleLanguage, moviesFolderPath);

    const row = database
      .prepare('SELECT language, subtitle_language, movies_folder_path FROM settings WHERE profile_id = ?')
      .get(profileId) as SettingsRow | undefined;
    return NextResponse.json(rowToJson(row));
  } catch (e) {
    console.error('settings PATCH', e);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
