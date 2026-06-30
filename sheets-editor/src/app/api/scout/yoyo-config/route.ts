import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ensureTabExists, readTab, appendRowsToTab, updateRowInTab } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

const TAB = 'YoyoConfig';
// MaxReserves is appended after UpdatedBy so existing rows (4 columns) stay compatible —
// the new column reads as empty/undefined and defaults to 3 until the next admin save.
const HEADERS = ['GreenMin', 'AmberMin', 'UpdatedAt', 'UpdatedBy', 'MaxReserves'];

const DEFAULTS = { greenMin: 15.5, amberMin: 15.2, maxReserves: 3 };

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
    const row = rows.find((r) => String(r['GreenMin'] || '').trim().length > 0);
    if (!row) return NextResponse.json(DEFAULTS);
    const greenMin = parseFloat(String(row['GreenMin']));
    const amberMin = parseFloat(String(row['AmberMin']));
    const maxReserves = parseInt(String(row['MaxReserves'] || ''), 10);
    return NextResponse.json({
      greenMin: isNaN(greenMin) ? DEFAULTS.greenMin : greenMin,
      amberMin: isNaN(amberMin) ? DEFAULTS.amberMin : amberMin,
      maxReserves: isNaN(maxReserves) ? DEFAULTS.maxReserves : maxReserves,
    });
  } catch (error: any) {
    if (error.name === 'AuthError') return NextResponse.json({ error: error.message }, { status: error.statusCode });
    return NextResponse.json(DEFAULTS);
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

    const body = await request.json() as { greenMin: number; amberMin: number; maxReserves?: number };
    if (typeof body.greenMin !== 'number' || typeof body.amberMin !== 'number') {
      return NextResponse.json({ error: 'greenMin and amberMin are required numbers' }, { status: 400 });
    }
    if (body.amberMin >= body.greenMin) {
      return NextResponse.json({ error: 'greenMin must be greater than amberMin' }, { status: 400 });
    }
    const maxReserves = typeof body.maxReserves === 'number'
      ? Math.max(0, Math.min(10, Math.floor(body.maxReserves)))
      : DEFAULTS.maxReserves;

    await ensureTabExists(TAB, HEADERS, sheetKey);
    const { rows } = await readTab(TAB, sheetKey);
    const values = [String(body.greenMin), String(body.amberMin), new Date().toISOString(), user.name || user.email, String(maxReserves)];
    const existing = rows.find((r) => String(r['GreenMin'] || '').trim().length > 0);
    if (existing) {
      await updateRowInTab(existing.__rowIndex as number, values, TAB, sheetKey);
    } else {
      await appendRowsToTab([values], TAB, sheetKey);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.name === 'AuthError') return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('[POST /api/scout/yoyo-config]', error);
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}
