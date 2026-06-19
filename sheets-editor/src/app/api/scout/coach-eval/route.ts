import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ensureTabExists, readTab, appendRowsToTab, updateRowInTab } from '@/lib/sheets';
import type { CoachEvalPayload } from '@/types/scout';

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

export const dynamic = 'force-dynamic';

const COACH_EVALS_TAB = 'CoachEvals';
const HEADERS = ['PlayerRowIndex', 'CoachEmail', 'CoachName', 'Evaluation', 'Score', 'Pct', 'Rating', 'Remarks', 'SavedAt'];

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sheetKey = url.searchParams.get('sheetKey') || 'tryout';

    const user = await requireAuth();

    if (!(await checkAuthorized(user.email, sheetKey))) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
    }

    const body = (await request.json()) as CoachEvalPayload;

    if (typeof body.playerRowIndex !== 'number' || body.playerRowIndex < 2) {
      return NextResponse.json({ error: 'Invalid playerRowIndex' }, { status: 400 });
    }

    await ensureTabExists(COACH_EVALS_TAB, HEADERS, sheetKey);

    const { rows } = await readTab(COACH_EVALS_TAB, sheetKey);

    const existingRow = rows.find(
      (r) =>
        Number(r['PlayerRowIndex']) === body.playerRowIndex &&
        String(r['CoachEmail']).toLowerCase() === user.email.toLowerCase()
    );

    const rowValues = [
      String(body.playerRowIndex),
      user.email,
      user.name,
      JSON.stringify(body.evaluation),
      String(body.score),
      String(body.pct),
      body.rating,
      body.remarks,
      new Date().toISOString(),
    ];

    if (existingRow) {
      await updateRowInTab(existingRow.__rowIndex as number, rowValues, COACH_EVALS_TAB, sheetKey);
    } else {
      await appendRowsToTab([rowValues], COACH_EVALS_TAB, sheetKey);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[POST /api/scout/coach-eval]', error);
    return NextResponse.json({ error: error.message || 'Failed to save evaluation' }, { status: 500 });
  }
}
