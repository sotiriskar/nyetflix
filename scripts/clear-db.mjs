#!/usr/bin/env node
/**
 * Clears all data from the SQLite database.
 * Stop the dev server before running: npm run clear-db
 */
import Database from 'better-sqlite3';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const dbPath = join(root, 'data', 'nyetflix.db');

const db = new Database(dbPath);
try {
  db.exec('DELETE FROM my_list; DELETE FROM liked; DELETE FROM settings; DELETE FROM profiles;');
  console.log('Database cleared: all rows removed from my_list, liked, settings, profiles.');
} finally {
  db.close();
}
https://help.netflix.com/