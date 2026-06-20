import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { readSheetData, readTab } from '@/lib/sheets';
import { parseEvaluation } from '@/lib/scout-schemas';
import type { ScoutApiResponse, ScoutPlayer, SchemaType, CoachEval } from '@/types/scout';

export const dynamic = 'force-dynamic';

const VALID_SCHEMAS: SchemaType[] = ['Batsman', 'Fast Bowler', 'Spin Bowler'];

const SYSTEM_COLUMNS = new Set([
  'Batch', 'Name', 'Div', 'Category', 'Schema',
  'Score', 'Pct', 'Rating', 'Remarks', 'Evaluation',
]);

function toSchemaType(raw: string): SchemaType {
  if (VALID_SCHEMAS.includes(raw as SchemaType)) return raw as SchemaType;
  return 'Batsman';
}

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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sheetKey = url.searchParams.get('sheetKey') || 'tryout';

    const user = await requireAuth();

    if (!(await checkAuthorized(user.email, sheetKey))) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
    }

    const [{ headers, rows }, isAdmin] = await Promise.all([
      readSheetData(sheetKey),
      checkAdmin(user.email, sheetKey),
    ]);

    const extraColumns = headers.filter((h) => !SYSTEM_COLUMNS.has(h));

    // Read coach evals (tab may not exist yet — that's fine)
    const coachEvalsMap = new Map<number, CoachEval[]>();
    try {
      const { rows: evalRows } = await readTab('CoachEvals', sheetKey);
      for (const row of evalRows) {
        const pIdx = Number(row['PlayerRowIndex']);
        if (!pIdx) continue;
        if (!coachEvalsMap.has(pIdx)) coachEvalsMap.set(pIdx, []);
        coachEvalsMap.get(pIdx)!.push({
          coachEmail: String(row['CoachEmail'] || ''),
          coachName: String(row['CoachName'] || ''),
          evaluation: parseEvaluation(String(row['Evaluation'] || '')),
          score: Number(row['Score'] || 0),
          pct: Number(row['Pct'] || 0),
          rating: String(row['Rating'] || ''),
          remarks: String(row['Remarks'] || ''),
          savedAt: String(row['SavedAt'] || ''),
        });
      }
    } catch {
      // CoachEvals tab doesn't exist yet
    }

    const players: ScoutPlayer[] = rows
      .map((row) => {
        const extraInfo: Record<string, string> = {};
        for (const col of extraColumns) {
          const val = String(row[col] ?? '').trim();
          if (val) extraInfo[col] = val;
        }

        const rowIndex = row.__rowIndex as number;
        const coachEvals = coachEvalsMap.get(rowIndex) || [];
        const aggregatePct = coachEvals.length > 0
          ? Math.round(coachEvals.reduce((sum, e) => sum + e.pct, 0) / coachEvals.length)
          : 0;
        const myEval = coachEvals.find((e) => e.coachEmail === user.email) || null;

        return {
          rowIndex,
          batch: String(row['Batch'] || '').trim(),
          name: String(row['Name'] || '').trim(),
          div: String(row['Div'] || '').trim(),
          category: String(row['Category'] || '').trim(),
          schema: toSchemaType(String(row['Schema'] || '')),
          score: myEval?.score ?? Number(row['Score'] || 0),
          pct: myEval?.pct ?? Number(row['Pct'] || 0),
          rating: myEval?.rating ?? String(row['Rating'] || ''),
          remarks: myEval?.remarks ?? String(row['Remarks'] || ''),
          evaluation: myEval?.evaluation ?? parseEvaluation(String(row['Evaluation'] || '')),
          extraInfo,
          coachEvals,
          myEval,
          aggregatePct,
        };
      })
      .filter((p) => p.name.length > 0);

    const response: ScoutApiResponse = {
      players,
      isEditor: user.isEditor,
      isAdmin,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[GET /api/scout]', error);
    return NextResponse.json(
      { error: 'Failed to fetch scout data. Check that the tryout sheet is configured in sheets-config.json.' },
      { status: 500 }
    );
  }
}
