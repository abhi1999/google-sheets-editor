import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ensureTabExists, readTab, appendRowsToTab, updateRowInTab } from '@/lib/sheets';
import { parseInGameRating } from '@/lib/ingame-schemas';
import type { InGameRatingPayload, InGameRatingRecord } from '@/types/scout';

export const dynamic = 'force-dynamic';

const TAB = 'InGameRatings';
const HEADERS = ['Id', 'CoachEmail', 'CoachName', 'PlayerRowIndex', 'TeamIndex', 'GameNumber', 'Rating', 'SavedAt'];

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

function recordId(coachEmail: string, playerRowIndex: number, teamIndex: number, gameNumber: number): string {
  return `${coachEmail.toLowerCase()}_${playerRowIndex}_${teamIndex}_${gameNumber}`;
}

function parseRecord(r: Record<string, unknown>): InGameRatingRecord {
  return {
    id: String(r['Id'] || ''),
    coachEmail: String(r['CoachEmail'] || ''),
    coachName: String(r['CoachName'] || ''),
    playerRowIndex: Number(r['PlayerRowIndex'] || 0),
    teamIndex: Number(r['TeamIndex'] || 0),
    gameNumber: Number(r['GameNumber'] || 0),
    rating: parseInGameRating(String(r['Rating'] || '')),
    savedAt: String(r['SavedAt'] || ''),
  };
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sheetKey = url.searchParams.get('sheetKey') || 'tryout';
    const gameNumber = url.searchParams.get('gameNumber');
    const teamIndex = url.searchParams.get('teamIndex');
    const playerRowIndex = url.searchParams.get('playerRowIndex');

    const user = await requireAuth();
    const isDemo = sheetKey === 'demo';

    if (!isDemo && !(await checkAuthorized(user.email, sheetKey))) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
    }

    await ensureTabExists(TAB, HEADERS, sheetKey);
    const { rows } = await readTab(TAB, sheetKey);

    let ratings = rows
      .filter((r) => String(r['Id'] || '').trim().length > 0)
      .map(parseRecord);

    if (gameNumber !== null) ratings = ratings.filter((r) => r.gameNumber === Number(gameNumber));
    if (teamIndex !== null) ratings = ratings.filter((r) => r.teamIndex === Number(teamIndex));
    if (playerRowIndex !== null) ratings = ratings.filter((r) => r.playerRowIndex === Number(playerRowIndex));

    return NextResponse.json({ ratings });
  } catch (error: any) {
    if (error.name === 'AuthError') return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('[GET /api/scout/in-game-ratings]', error);
    return NextResponse.json({ error: 'Failed to fetch ratings' }, { status: 500 });
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

    const body = (await request.json()) as InGameRatingPayload;

    if (typeof body.playerRowIndex !== 'number' || body.playerRowIndex < 2) {
      return NextResponse.json({ error: 'Invalid playerRowIndex' }, { status: 400 });
    }
    if (typeof body.teamIndex !== 'number' || body.teamIndex < 1 || body.teamIndex > 6) {
      return NextResponse.json({ error: 'Invalid teamIndex' }, { status: 400 });
    }
    if (typeof body.gameNumber !== 'number' || body.gameNumber < 1 || body.gameNumber > 6) {
      return NextResponse.json({ error: 'Invalid gameNumber' }, { status: 400 });
    }
    if (typeof body.rating !== 'object' || body.rating === null) {
      return NextResponse.json({ error: 'Invalid rating' }, { status: 400 });
    }

    await ensureTabExists(TAB, HEADERS, sheetKey);

    // One editable rating per coach per player per game — deterministic id means
    // re-saving (whether the coach reopens "Rate" or an offline retry replays the
    // same request) always lands on the same row instead of creating a duplicate.
    const id = recordId(user.email, body.playerRowIndex, body.teamIndex, body.gameNumber);
    const rowValues = [
      id,
      user.email,
      user.name,
      String(body.playerRowIndex),
      String(body.teamIndex),
      String(body.gameNumber),
      JSON.stringify(body.rating),
      new Date().toISOString(),
    ];

    const { rows } = await readTab(TAB, sheetKey);
    const existing = rows.find((r) => String(r['Id']) === id);

    if (existing) {
      await updateRowInTab(existing.__rowIndex as number, rowValues, TAB, sheetKey);
    } else {
      await appendRowsToTab([rowValues], TAB, sheetKey);
    }

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    if (error.name === 'AuthError') return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('[POST /api/scout/in-game-ratings]', error);
    return NextResponse.json({ error: error.message || 'Failed to save rating' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sheetKey = url.searchParams.get('sheetKey') || 'tryout';
    const id = url.searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const user = await requireAuth();
    const isDemo = sheetKey === 'demo';

    if (!isDemo && !(await checkAuthorized(user.email, sheetKey))) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
    }

    await ensureTabExists(TAB, HEADERS, sheetKey);
    const { rows } = await readTab(TAB, sheetKey);

    const row = rows.find((r) => String(r['Id']) === id);
    if (!row) return NextResponse.json({ error: 'Rating not found' }, { status: 404 });

    if (String(row['CoachEmail'] || '').toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json({ error: 'You can only delete your own ratings' }, { status: 403 });
    }

    // Clear the row — blank Id means it will be filtered out on future reads
    await updateRowInTab(row.__rowIndex as number, ['', '', '', '', '', '', '', ''], TAB, sheetKey);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.name === 'AuthError') return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('[DELETE /api/scout/in-game-ratings]', error);
    return NextResponse.json({ error: error.message || 'Failed to delete rating' }, { status: 500 });
  }
}
