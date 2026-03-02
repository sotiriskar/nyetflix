import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { AVATAR_PATHS, getFirstUnusedAvatar, isProfileId, MAX_PROFILES } from '@/lib/profiles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export type ProfileRow = { id: number; name: string; avatar_path: string; is_kid: number };

const DEFAULT_PROFILE_NAME = 'User';
const DEFAULT_AVATAR = AVATAR_PATHS[0];

export async function GET() {
  try {
    const database = getDb();
    let rows = database.prepare('SELECT id, name, avatar_path, is_kid FROM profiles ORDER BY id').all() as ProfileRow[];
    if (rows.length === 0) {
      database.prepare('INSERT INTO profiles (id, name, avatar_path, is_kid) VALUES (1, ?, ?, 0)').run(DEFAULT_PROFILE_NAME, DEFAULT_AVATAR);
      database.prepare('INSERT INTO settings (profile_id, language, subtitle_language, movies_folder_path) VALUES (1, ?, ?, ?)').run('en', 'en', '');
      rows = database.prepare('SELECT id, name, avatar_path, is_kid FROM profiles ORDER BY id').all() as ProfileRow[];
    }
    return NextResponse.json(rows.map((r) => ({ id: r.id, name: r.name, avatarPath: r.avatar_path, isKid: r.is_kid === 1 })));
  } catch (e) {
    console.error('profiles GET', e);
    return NextResponse.json({ error: 'Failed to load profiles' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const database = getDb();
    const existing = database.prepare('SELECT id FROM profiles ORDER BY id').all() as { id: number }[];
    if (existing.length >= MAX_PROFILES) {
      return NextResponse.json({ error: 'Maximum number of profiles (5) reached' }, { status: 400 });
    }
    const used = new Set(existing.map((r) => r.id));
    let newId: number | null = null;
    for (let i = 1; i <= MAX_PROFILES; i++) {
      if (!used.has(i)) {
        newId = i;
        break;
      }
    }
    if (newId == null) {
      return NextResponse.json({ error: 'No profile slot available' }, { status: 400 });
    }
    const body = (await request.json()) as { name?: string; avatarPath?: string; isKid?: boolean };
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : `Profile ${newId}`;
    const usedPaths = (database.prepare('SELECT avatar_path FROM profiles').all() as { avatar_path: string }[]).map((r) => r.avatar_path);
    const avatarPath = typeof body.avatarPath === 'string' && body.avatarPath
      ? body.avatarPath
      : getFirstUnusedAvatar(usedPaths);
    const isKid = body.isKid ? 1 : 0;
    database.prepare('INSERT INTO profiles (id, name, avatar_path, is_kid) VALUES (?, ?, ?, ?)').run(newId, name, avatarPath, isKid);
    database.prepare('INSERT INTO settings (profile_id, language, subtitle_language, movies_folder_path) VALUES (?, ?, ?, ?)').run(newId, 'en', 'en', '');
    const row = database.prepare('SELECT id, name, avatar_path, is_kid FROM profiles WHERE id = ?').get(newId) as ProfileRow;
    return NextResponse.json({ id: row.id, name: row.name, avatarPath: row.avatar_path, isKid: row.is_kid === 1 });
  } catch (e) {
    console.error('profiles POST', e);
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as { id?: number; name?: string; avatarPath?: string; isKid?: boolean };
    const id = body.id;
    if (id == null || !isProfileId(id)) {
      return NextResponse.json({ error: 'Invalid profile id' }, { status: 400 });
    }
    const database = getDb();
    const row = database.prepare('SELECT name, avatar_path, is_kid FROM profiles WHERE id = ?').get(id) as ProfileRow | undefined;
    if (!row) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    const name = body.name !== undefined ? String(body.name).trim() || row.name : row.name;
    const avatarPath = body.avatarPath !== undefined ? String(body.avatarPath) : row.avatar_path;
    const isKid = body.isKid !== undefined ? (body.isKid ? 1 : 0) : row.is_kid;
    database.prepare('UPDATE profiles SET name = ?, avatar_path = ?, is_kid = ? WHERE id = ?').run(name, avatarPath, isKid, id);
    const updated = database.prepare('SELECT id, name, avatar_path, is_kid FROM profiles WHERE id = ?').get(id) as ProfileRow;
    return NextResponse.json({ id: updated.id, name: updated.name, avatarPath: updated.avatar_path, isKid: updated.is_kid === 1 });
  } catch (e) {
    console.error('profiles PATCH', e);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const idParam = request.nextUrl.searchParams.get('id');
    const id = idParam != null ? parseInt(idParam, 10) : undefined;
    if (id == null || !isProfileId(id)) {
      return NextResponse.json({ error: 'Invalid profile id' }, { status: 400 });
    }
    const database = getDb();
    const exists = database.prepare('SELECT 1 FROM profiles WHERE id = ?').get(id);
    if (!exists) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    const count = (database.prepare('SELECT COUNT(*) as c FROM profiles').get() as { c: number }).c;
    if (count <= 1) {
      return NextResponse.json({ error: 'You must keep at least one profile.' }, { status: 400 });
    }
    database.prepare('DELETE FROM my_list WHERE profile_id = ?').run(id);
    database.prepare('DELETE FROM liked WHERE profile_id = ?').run(id);
    database.prepare('DELETE FROM settings WHERE profile_id = ?').run(id);
    database.prepare('DELETE FROM profiles WHERE id = ?').run(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('profiles DELETE', e);
    return NextResponse.json({ error: 'Failed to delete profile' }, { status: 500 });
  }
}
