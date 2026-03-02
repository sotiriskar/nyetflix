import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { MAX_PROFILES } from './profiles';

const DATA_DIR = join(process.cwd(), 'data');
const DB_PATH = join(DATA_DIR, 'nyetflix.db');

let db: Database.Database | null = null;

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function runMigrations(database: Database.Database) {
  const hasProfiles = database.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name='profiles'"
  ).get();
  if (hasProfiles) {
    ensureSettingsRows(database);
    return;
  }

  // Create profiles table (id 1..5 slots; no seed – users create up to 5 via settings)
  database.exec(`
    CREATE TABLE profiles (
      id INTEGER PRIMARY KEY CHECK (id >= 1 AND id <= ${MAX_PROFILES}),
      name TEXT NOT NULL,
      avatar_path TEXT NOT NULL,
      is_kid INTEGER NOT NULL DEFAULT 0
    );
  `);
  ensureSettingsRows(database);

  // Migrate my_list: add profile_id (default 1)
  const myListInfo = database.prepare("PRAGMA table_info(my_list)").all() as { name: string }[];
  if (myListInfo.length > 0 && !myListInfo.some((c) => c.name === 'profile_id')) {
    database.exec(`
      CREATE TABLE my_list_new (profile_id INTEGER NOT NULL DEFAULT 1, item_id TEXT NOT NULL, added_at INTEGER NOT NULL, PRIMARY KEY (profile_id, item_id));
      INSERT INTO my_list_new (profile_id, item_id, added_at) SELECT 1, item_id, added_at FROM my_list;
      DROP TABLE my_list;
      ALTER TABLE my_list_new RENAME TO my_list;
    `);
  } else if (myListInfo.length === 0) {
    database.exec(`
      CREATE TABLE my_list (profile_id INTEGER NOT NULL, item_id TEXT NOT NULL, added_at INTEGER NOT NULL, PRIMARY KEY (profile_id, item_id));
    `);
  }

  // Migrate liked
  const likedInfo = database.prepare("PRAGMA table_info(liked)").all() as { name: string }[];
  if (likedInfo.length > 0 && !likedInfo.some((c) => c.name === 'profile_id')) {
    database.exec(`
      CREATE TABLE liked_new (profile_id INTEGER NOT NULL DEFAULT 1, item_id TEXT NOT NULL, PRIMARY KEY (profile_id, item_id));
      INSERT INTO liked_new (profile_id, item_id) SELECT 1, item_id FROM liked;
      DROP TABLE liked;
      ALTER TABLE liked_new RENAME TO liked;
    `);
  } else if (likedInfo.length === 0) {
    database.exec(`
      CREATE TABLE liked (profile_id INTEGER NOT NULL, item_id TEXT NOT NULL, PRIMARY KEY (profile_id, item_id));
    `);
  }

  // Migrate settings: one row per profile
  const settingsInfo = database.prepare("PRAGMA table_info(settings)").all() as { name: string }[];
  const hasProfileIdInSettings = settingsInfo.some((c) => c.name === 'profile_id');
  if (settingsInfo.length > 0 && !hasProfileIdInSettings) {
    const row = database.prepare('SELECT language, subtitle_language, movies_folder_path FROM settings WHERE id = 1').get() as { language: string; subtitle_language: string; movies_folder_path: string } | undefined;
    database.exec(`
      CREATE TABLE settings_new (profile_id INTEGER PRIMARY KEY CHECK (profile_id >= 1 AND profile_id <= ${MAX_PROFILES}), language TEXT, subtitle_language TEXT, movies_folder_path TEXT);
    `);
    if (row) {
      database.prepare('INSERT INTO settings_new (profile_id, language, subtitle_language, movies_folder_path) VALUES (1, ?, ?, ?)').run(row.language ?? 'en', row.subtitle_language ?? 'en', row.movies_folder_path ?? '');
    }
    database.exec('DROP TABLE settings');
    database.exec('ALTER TABLE settings_new RENAME TO settings');
  } else if (settingsInfo.length === 0) {
    database.exec(`
      CREATE TABLE settings (profile_id INTEGER PRIMARY KEY CHECK (profile_id >= 1 AND profile_id <= ${MAX_PROFILES}), language TEXT, subtitle_language TEXT, movies_folder_path TEXT);
    `);
  }
  ensureSettingsRows(database);
}

/** Ensure a settings row exists for each profile that exists (e.g. after migration). */
function ensureSettingsRows(database: Database.Database) {
  const tableExists = database.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name='profiles'"
  ).get();
  if (!tableExists) return;
  const rows = database.prepare('SELECT id FROM profiles').all() as { id: number }[];
  for (const { id } of rows) {
    try {
      database.prepare('INSERT OR IGNORE INTO settings (profile_id, language, subtitle_language, movies_folder_path) VALUES (?, ?, ?, ?)').run(id, 'en', 'en', '');
    } catch {
      // ignore
    }
  }
}

export function getDb(): Database.Database {
  if (!db) {
    ensureDataDir();
    db = new Database(DB_PATH);
    db.exec(`
      CREATE TABLE IF NOT EXISTS my_list (
        profile_id INTEGER NOT NULL,
        item_id TEXT NOT NULL,
        added_at INTEGER NOT NULL,
        PRIMARY KEY (profile_id, item_id)
      );
      CREATE TABLE IF NOT EXISTS liked (
        profile_id INTEGER NOT NULL,
        item_id TEXT NOT NULL,
        PRIMARY KEY (profile_id, item_id)
      );
      CREATE TABLE IF NOT EXISTS settings (
        profile_id INTEGER PRIMARY KEY CHECK (profile_id >= 1 AND profile_id <= ${MAX_PROFILES}),
        language TEXT,
        subtitle_language TEXT,
        movies_folder_path TEXT
      );
    `);
    runMigrations(db);
  }
  return db;
}
