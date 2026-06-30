import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ensureTabExists, readTab, appendRowsToTab, updateRowInTab } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

const TAB = 'PlayerSelection';
const HEADERS = ['PlayerRowIndex', 'PlayerName', 'Selected', 'UpdatedAt', 'UpdatedBy'];

async function checkAdmin(userEmail: string, sheetKey: string): Promise<boolean> {
  try {
    const { rows } = await readTab('AdminUsers', sheetKey);
    return rows.some((row) =>
      Object.entries(row)
        .filter(([k]) => k !== '__rowIndex')
        .some(([, v]) => typeof v === 'string' && v.trim().toLowerCase() === userEmail.toLowerCase())
    );
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sheetKey = url.searchParams.get('sheetKey') || 'tryout';
    await requireAuth();
    await ensureTabExists(TAB, HEADERS, sheetKey);
    const { rows } = await readTab(TAB, sheetKey);
    const selections: Record<number, boolean> = {};
    for (const row of rows) {
      const idx = parseInt(String(row['PlayerRowIndex'] || ''), 10);
      const sel = String(row['Selected'] || '').trim().toLowerCase();
      if (!isNaN(idx) && (sel === 'true' || sel === 'false')) {
        selections[idx] = sel === 'true';
      }
    }
    return NextResponse.json({ selections });
  } catch (error: any) {
    if (error.name === 'AuthError') return NextResponse.json({ error: error.message }, { status: error.statusCode });
    return NextResponse.json({ selections: {} });
  }
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sheetKey = url.searchParams.get('sheetKey') || 'tryout';
    const user = await requireAuth();

    if (!(await checkAdmin(user.email, sheetKey))) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
    }

    const body = await request.json() as { playerRowIndex: number; playerName: string; selected: boolean };
    if (typeof body.playerRowIndex !== 'number' || typeof body.selected !== 'boolean') {
      return NextResponse.json({ error: 'playerRowIndex and selected are required' }, { status: 400 });
    }

    await ensureTabExists(TAB, HEADERS, sheetKey);
    const { rows } = await readTab(TAB, sheetKey);
    const values = [
      String(body.playerRowIndex),
      body.playerName || '',
      String(body.selected),
      new Date().toISOString(),
      user.name || user.email,
    ];

    const existing = rows.find((r) => String(r['PlayerRowIndex']) === String(body.playerRowIndex));
    if (existing) {
      await updateRowInTab(existing.__rowIndex as number, values, TAB, sheetKey);
    } else {
      await appendRowsToTab([values], TAB, sheetKey);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.name === 'AuthError') return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('[POST /api/scout/player-selection]', error);
    return NextResponse.json({ error: 'Failed to save selection' }, { status: 500 });
  }
}
