import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ensureTabExists, readTab, appendRowsToTab, updateRowInTab } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

const TAB = 'PivotFilters';
const HEADERS = ['FilterId', 'FilterName', 'Data', 'SavedAt', 'SavedBy'];

async function checkAuthorized(userEmail: string, sheetKey: string): Promise<boolean> {
  try {
    const { rows } = await readTab('AuthorizedUsers', sheetKey);
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
    const user = await requireAuth();

    if (sheetKey !== 'demo' && !(await checkAuthorized(user.email, sheetKey))) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
    }

    await ensureTabExists(TAB, HEADERS, sheetKey);
    const { rows } = await readTab(TAB, sheetKey);

    const filters = rows
      .filter((r) => String(r['FilterId'] || '').trim().length > 0)
      .map((r) => {
        try { return JSON.parse(String(r['Data'] || '{}')); } catch { return null; }
      })
      .filter(Boolean);

    return NextResponse.json({ filters });
  } catch (error: any) {
    if (error.name === 'AuthError') return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('[GET /api/scout/pivot-filters]', error);
    return NextResponse.json({ error: 'Failed to fetch filters' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sheetKey = url.searchParams.get('sheetKey') || 'tryout';
    const user = await requireAuth();

    if (sheetKey !== 'demo' && !(await checkAuthorized(user.email, sheetKey))) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
    }

    const body = await request.json() as { id?: string; name: string; [key: string]: unknown };
    const filterId = body.id || `pf_${Date.now()}`;
    const filterData = { ...body, id: filterId };

    await ensureTabExists(TAB, HEADERS, sheetKey);
    const { rows } = await readTab(TAB, sheetKey);

    const existingRow = rows.find((r) => String(r['FilterId']) === filterId);
    const rowValues = [
      filterId,
      body.name,
      JSON.stringify(filterData),
      new Date().toISOString(),
      user.name || user.email,
    ];

    if (existingRow) {
      await updateRowInTab(existingRow.__rowIndex as number, rowValues, TAB, sheetKey);
    } else {
      await appendRowsToTab([rowValues], TAB, sheetKey);
    }

    return NextResponse.json({ success: true, filterId });
  } catch (error: any) {
    if (error.name === 'AuthError') return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('[POST /api/scout/pivot-filters]', error);
    return NextResponse.json({ error: 'Failed to save filter' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sheetKey = url.searchParams.get('sheetKey') || 'tryout';
    const filterId = url.searchParams.get('filterId');

    if (!filterId) return NextResponse.json({ error: 'filterId required' }, { status: 400 });

    const user = await requireAuth();

    if (sheetKey !== 'demo' && !(await checkAuthorized(user.email, sheetKey))) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
    }

    await ensureTabExists(TAB, HEADERS, sheetKey);
    const { rows } = await readTab(TAB, sheetKey);

    const row = rows.find((r) => String(r['FilterId']) === filterId);
    if (!row) return NextResponse.json({ error: 'Filter not found' }, { status: 404 });

    await updateRowInTab(row.__rowIndex as number, ['', '', '', '', ''], TAB, sheetKey);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.name === 'AuthError') return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('[DELETE /api/scout/pivot-filters]', error);
    return NextResponse.json({ error: 'Failed to delete filter' }, { status: 500 });
  }
}
