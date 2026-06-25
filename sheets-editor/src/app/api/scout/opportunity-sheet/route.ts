import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ensureTabExists, readTab, appendRowsToTab, updateRowInTab } from '@/lib/sheets';
import { parseOpportunityEntries } from '@/lib/opportunity-schemas';
import type { OpportunitySheetPayload, OpportunityRecord } from '@/types/scout';

export const dynamic = 'force-dynamic';

const TAB = 'OpportunitySheet';
const HEADERS = ['Key', 'TeamIndex', 'GameNumber', 'CoachName', 'Entries', 'UpdatedBy', 'UpdatedByName', 'UpdatedAt'];

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

function recordKey(teamIndex: number, gameNumber: number): string {
  return `${teamIndex}_${gameNumber}`;
}

function parseRecord(r: Record<string, unknown>): OpportunityRecord {
  return {
    teamIndex: Number(r['TeamIndex'] || 0),
    gameNumber: Number(r['GameNumber'] || 0),
    coachName: String(r['CoachName'] || ''),
    entries: parseOpportunityEntries(String(r['Entries'] || '')),
    updatedBy: String(r['UpdatedBy'] || ''),
    updatedByName: String(r['UpdatedByName'] || ''),
    updatedAt: String(r['UpdatedAt'] || ''),
  };
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sheetKey = url.searchParams.get('sheetKey') || 'tryout';
    const teamIndex = url.searchParams.get('teamIndex');
    const gameNumber = url.searchParams.get('gameNumber');

    const user = await requireAuth();
    const isDemo = sheetKey === 'demo';

    if (!isDemo && !(await checkAuthorized(user.email, sheetKey))) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
    }

    await ensureTabExists(TAB, HEADERS, sheetKey);
    const { rows } = await readTab(TAB, sheetKey);

    let records = rows
      .filter((r) => String(r['Key'] || '').trim().length > 0)
      .map(parseRecord);

    if (teamIndex !== null) records = records.filter((r) => r.teamIndex === Number(teamIndex));
    if (gameNumber !== null) records = records.filter((r) => r.gameNumber === Number(gameNumber));

    return NextResponse.json({ records });
  } catch (error: any) {
    if (error.name === 'AuthError') return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('[GET /api/scout/opportunity-sheet]', error);
    return NextResponse.json({ error: 'Failed to fetch opportunity sheet' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sheetKey = url.searchParams.get('sheetKey') || 'tryout';
    const user = await requireAuth();
    const isDemo = sheetKey === 'demo';

    if (!isDemo && !(await checkAuthorized(user.email, sheetKey))) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
    }

    const body = (await request.json()) as OpportunitySheetPayload;

    if (typeof body.teamIndex !== 'number' || body.teamIndex < 1 || body.teamIndex > 6) {
      return NextResponse.json({ error: 'Invalid teamIndex' }, { status: 400 });
    }
    if (typeof body.gameNumber !== 'number' || body.gameNumber < 1 || body.gameNumber > 6) {
      return NextResponse.json({ error: 'Invalid gameNumber' }, { status: 400 });
    }
    if (!Array.isArray(body.entries)) {
      return NextResponse.json({ error: 'Invalid entries' }, { status: 400 });
    }

    await ensureTabExists(TAB, HEADERS, sheetKey);

    const key = recordKey(body.teamIndex, body.gameNumber);
    const updatedAt = new Date().toISOString();
    const rowValues = [
      key,
      String(body.teamIndex),
      String(body.gameNumber),
      typeof body.coachName === 'string' ? body.coachName : '',
      JSON.stringify(body.entries),
      user.email,
      user.name,
      updatedAt,
    ];

    // Single shared record per team+game — overwrite in place rather than append.
    const { rows } = await readTab(TAB, sheetKey);
    const existing = rows.find((r) => String(r['Key']) === key);

    if (existing) {
      await updateRowInTab(existing.__rowIndex as number, rowValues, TAB, sheetKey);
    } else {
      await appendRowsToTab([rowValues], TAB, sheetKey);
    }

    return NextResponse.json({ success: true, updatedAt });
  } catch (error: any) {
    if (error.name === 'AuthError') return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('[POST /api/scout/opportunity-sheet]', error);
    return NextResponse.json({ error: error.message || 'Failed to save opportunity sheet' }, { status: 500 });
  }
}
