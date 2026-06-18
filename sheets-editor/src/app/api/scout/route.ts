import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { readSheetData } from '@/lib/sheets';
import { parseEvaluation } from '@/lib/scout-schemas';
import type { ScoutApiResponse, ScoutPlayer, SchemaType } from '@/types/scout';

export const dynamic = 'force-dynamic';

const VALID_SCHEMAS: SchemaType[] = ['Batsman', 'Fast Bowler', 'Spin Bowler'];

function toSchemaType(raw: string): SchemaType {
  if (VALID_SCHEMAS.includes(raw as SchemaType)) return raw as SchemaType;
  return 'Batsman';
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sheetKey = url.searchParams.get('sheetKey') || 'tryout';

    const user = await requireAuth();
    const { rows } = await readSheetData(sheetKey);

    const players: ScoutPlayer[] = rows
      .map((row) => ({
        rowIndex: row.__rowIndex as number,
        name: String(row['Name'] || '').trim(),
        category: String(row['Category'] || '').trim(),
        schema: toSchemaType(String(row['Schema'] || '')),
        score: Number(row['Score'] || 0),
        pct: Number(row['Pct'] || 0),
        rating: String(row['Rating'] || ''),
        remarks: String(row['Remarks'] || ''),
        evaluation: parseEvaluation(String(row['Evaluation'] || '')),
      }))
      .filter((p) => p.name.length > 0);

    const response: ScoutApiResponse = {
      players,
      isEditor: user.isEditor,
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
