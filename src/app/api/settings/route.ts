import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ROW_ID = 1;

type SettingsRow = {
  language: string | null;
  subtitle_language: string | null;
  movies_folder_path: string | null;
  profile_name: string | null;
  profile_is_kid: number | null;
};

function rowToJson(row: SettingsRow | undefined): SettingsState & { saved: boolean } {
  const state = !row
    ? { language: 'en' as const, subtitleLanguage: 'en' as const, moviesFolderPath: '', profileName: 'Profile', profileIsKid: false }
    : {
        language: (row.language === 'el' ? 'el' : 'en') as 'en' | 'el',
        subtitleLanguage: (row.subtitle_language === 'el' ? 'el' : 'en') as 'en' | 'el',
        moviesFolderPath: row.movies_folder_path ?? '',
        profileName: row.profile_name ?? 'Profile',
        profileIsKid: row.profile_is_kid === 1,
      };
  return { ...state, saved: !!row };
}

type SettingsState = {
  language: 'en' | 'el';
  subtitleLanguage: 'en' | 'el';
  moviesFolderPath: string;
  profileName: string;
  profileIsKid: boolean;
};

export async function GET() {
  try {
    const database = getDb();
    const row = database
      .prepare(
        'SELECT language, subtitle_language, movies_folder_path, profile_name, profile_is_kid FROM settings WHERE id = ?'
      )
      .get(ROW_ID) as SettingsRow | undefined;
    const out = rowToJson(row);
    return NextResponse.json(out);
  } catch (e) {
    console.error('settings GET', e);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const database = getDb();

    const current = database
      .prepare(
        'SELECT language, subtitle_language, movies_folder_path, profile_name, profile_is_kid FROM settings WHERE id = ?'
      )
      .get(ROW_ID) as SettingsRow | undefined;

    const cur = rowToJson(current);
    const language = body.language !== undefined ? (body.language === 'el' ? 'el' : 'en') : cur.language;
    const subtitleLanguage = body.subtitleLanguage !== undefined ? (body.subtitleLanguage === 'el' ? 'el' : 'en') : cur.subtitleLanguage;
    const moviesFolderPath = body.moviesFolderPath !== undefined ? String(body.moviesFolderPath) : cur.moviesFolderPath;
    const profileName = body.profileName !== undefined ? String(body.profileName) : cur.profileName;
    const profileIsKid = body.profileIsKid !== undefined ? Boolean(body.profileIsKid) : cur.profileIsKid;

    database
      .prepare(
        `INSERT INTO settings (id, language, subtitle_language, movies_folder_path, profile_name, profile_is_kid)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           language = excluded.language,
           subtitle_language = excluded.subtitle_language,
           movies_folder_path = excluded.movies_folder_path,
           profile_name = excluded.profile_name,
           profile_is_kid = excluded.profile_is_kid`
      )
      .run(ROW_ID, language, subtitleLanguage, moviesFolderPath, profileName, profileIsKid ? 1 : 0);

    const row = database
      .prepare(
        'SELECT language, subtitle_language, movies_folder_path, profile_name, profile_is_kid FROM settings WHERE id = ?'
      )
      .get(ROW_ID) as SettingsRow | undefined;
    return NextResponse.json(rowToJson(row));
  } catch (e) {
    console.error('settings PATCH', e);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
