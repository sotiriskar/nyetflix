import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const database = getDb();
    const rows = database.prepare('SELECT item_id AS id FROM liked').all() as { id: string }[];
    return NextResponse.json(rows.map((r) => r.id));
  } catch (e) {
    console.error('liked GET', e);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const id = typeof body?.id === 'string' ? body.id.trim() : null;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const database = getDb();
    database.prepare('INSERT OR IGNORE INTO liked (item_id) VALUES (?)').run(id);
    return NextResponse.json({ id });
  } catch (e) {
    console.error('liked POST', e);
    return NextResponse.json({ error: 'Failed to add' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const database = getDb();
    database.prepare('DELETE FROM liked WHERE item_id = ?').run(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('liked DELETE', e);
    return NextResponse.json({ error: 'Failed to remove' }, { status: 500 });
  }
}
