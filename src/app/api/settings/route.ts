import { NextRequest, NextResponse } from 'next/server';
import type Database from 'better-sqlite3';
import { getDb } from '@/lib/db';
import { getProfileIdFromRequest } from '@/lib/profileIdFromRequest';
import {
  getProfileSource,
  saveSource,
  sourceFromInput,
  sourceLibraryPath,
} from '@/lib/storage/sources';
import { LIBRARY_HANDLE_MODE } from '@/lib/libraryHandleMode';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SettingsRow = {
  language: string | null;
  subtitle_language: string | null;
  movies_folder_path: string | null;
  library_source_id: string | null;
};

type SettingsState = {
  language: 'en' | 'el';
  subtitleLanguage: 'off' | string;
  /** Folder the library is scanned from, resolved from the selected media source. */
  moviesFolderPath: string;
  /** The profile's selected media source ('' when none). */
  librarySourceId: string;
};

const SELECT = 'SELECT language, subtitle_language, movies_folder_path, library_source_id FROM settings WHERE profile_id = ?';

function parseSubtitleLanguage(v: string | null): 'off' | string {
  if (v == null || v === '') return 'off';
  const s = String(v).trim().toLowerCase();
  if (s === 'off') return 'off';
  return s; // any language code (en, el, spa, etc.)
}

/**
 * Before media sources existed, a profile stored a bare folder path. Turn it into a "Local
 * folder" source once, so the profile keeps its library and sees it in the new list.
 */
function migrateLegacyPath(db: Database.Database, profileId: number, row: SettingsRow): SettingsRow {
  const legacy = (row.movies_folder_path ?? '').trim();
  if (row.library_source_id || !legacy || legacy === LIBRARY_HANDLE_MODE) return row;
  const isShare = legacy.startsWith('\\\\') || legacy.startsWith('//');
  const source = saveSource(
    sourceFromInput({ type: 'local', variant: isShare ? 'share' : 'folder', path: legacy }, profileId),
  );
  db.prepare('UPDATE settings SET library_source_id = ? WHERE profile_id = ?').run(source.id, profileId);
  return { ...row, library_source_id: source.id };
}

function rowToJson(profileId: number, row: SettingsRow | undefined): SettingsState & { saved: boolean } {
  if (!row) {
    return { language: 'en', subtitleLanguage: 'off', moviesFolderPath: '', librarySourceId: '', saved: false };
  }
  const source = row.library_source_id ? getProfileSource(profileId, row.library_source_id) : undefined;
  // Browser-folder mode (File System Access handle) has no source; keep its marker path.
  const legacyPath = row.movies_folder_path === LIBRARY_HANDLE_MODE ? LIBRARY_HANDLE_MODE : '';
  return {
    language: row.language === 'el' ? 'el' : 'en',
    subtitleLanguage: parseSubtitleLanguage(row.subtitle_language),
    moviesFolderPath: source ? sourceLibraryPath(source) : legacyPath,
    librarySourceId: source?.id ?? '',
    saved: true,
  };
}

function load(db: Database.Database, profileId: number) {
  const row = db.prepare(SELECT).get(profileId) as SettingsRow | undefined;
  return rowToJson(profileId, row ? migrateLegacyPath(db, profileId, row) : undefined);
}

export async function GET(request: NextRequest) {
  try {
    const profileId = getProfileIdFromRequest(request);
    return NextResponse.json(load(getDb(), profileId));
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
    const cur = load(database, profileId);

    const language = body.language !== undefined ? (body.language === 'el' ? 'el' : 'en') : cur.language;
    const subtitleLanguage = body.subtitleLanguage !== undefined ? parseSubtitleLanguage(String(body.subtitleLanguage)) : cur.subtitleLanguage;

    let librarySourceId: string | null = cur.librarySourceId || null;
    let moviesFolderPath = cur.moviesFolderPath;
    if (body.librarySourceId !== undefined) {
      const id = String(body.librarySourceId);
      const source = id ? getProfileSource(profileId, id) : undefined;
      if (id && !source) return NextResponse.json({ error: 'Unknown media source' }, { status: 400 });
      librarySourceId = source?.id ?? null;
      moviesFolderPath = source ? sourceLibraryPath(source) : '';
    } else if (body.moviesFolderPath !== undefined) {
      // Only the browser-folder mode still sets a raw path; anything else goes through sources.
      moviesFolderPath = String(body.moviesFolderPath);
      if (moviesFolderPath === LIBRARY_HANDLE_MODE || moviesFolderPath === '') librarySourceId = null;
    }

    database
      .prepare(
        `INSERT INTO settings (profile_id, language, subtitle_language, movies_folder_path, library_source_id)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(profile_id) DO UPDATE SET
           language = excluded.language,
           subtitle_language = excluded.subtitle_language,
           movies_folder_path = excluded.movies_folder_path,
           library_source_id = excluded.library_source_id`
      )
      .run(profileId, language, subtitleLanguage, moviesFolderPath, librarySourceId);

    return NextResponse.json(load(database, profileId));
  } catch (e) {
    console.error('settings PATCH', e);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
