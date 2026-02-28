import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const database = getDb();
    const rows = database.prepare('SELECT item_id AS id, added_at AS addedAt FROM my_list ORDER BY added_at DESC').all() as { id: string; addedAt: number }[];
    return NextResponse.json(rows);
  } catch (e) {
    console.error('my-list GET', e);
    return NextResponse.json({ error: 'Failed to load list' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const id = typeof body?.id === 'string' ? body.id.trim() : null;
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }
    const database = getDb();
    const addedAt = Date.now();
    database
      .prepare('INSERT OR IGNORE INTO my_list (item_id, added_at) VALUES (?, ?)')
      .run(id, addedAt);
    return NextResponse.json({ id, addedAt });
  } catch (e) {
    console.error('my-list POST', e);
    return NextResponse.json({ error: 'Failed to add' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }
    const database = getDb();
    database.prepare('DELETE FROM my_list WHERE item_id = ?').run(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('my-list DELETE', e);
    return NextResponse.json({ error: 'Failed to remove' }, { status: 500 });
  }
}
