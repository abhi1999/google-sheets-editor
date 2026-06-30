import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ensureTabExists, readTab, appendRowsToTab, updateRowInTab } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

const TAB = 'YoyoConfig';
const HEADERS = ['GreenMin', 'AmberMin', 'UpdatedAt', 'UpdatedBy'];

const DEFAULTS = { greenMin: 15.5, amberMin: 15.2 };

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
    return NextResponse.json({
      greenMin: isNaN(greenMin) ? DEFAULTS.greenMin : greenMin,
      amberMin: isNaN(amberMin) ? DEFAULTS.amberMin : amberMin,
    });
  } catch (error: any) {
    if (error.name === 'AuthError') return NextResponse.json({ error: error.message }, { status: error.statusCode });
    // On any other error, return defaults so the UI still works
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

    const body = await request.json() as { greenMin: number; amberMin: number };
    if (typeof body.greenMin !== 'number' || typeof body.amberMin !== 'number') {
      return NextResponse.json({ error: 'greenMin and amberMin are required numbers' }, { status: 400 });
    }
    if (body.amberMin >= body.greenMin) {
      return NextResponse.json({ error: 'greenMin must be greater than amberMin' }, { status: 400 });
    }

    await ensureTabExists(TAB, HEADERS, sheetKey);
    const { rows } = await readTab(TAB, sheetKey);
    const values = [String(body.greenMin), String(body.amberMin), new Date().toISOString(), user.name || user.email];
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
