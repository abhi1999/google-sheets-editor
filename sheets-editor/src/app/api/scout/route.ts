import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { readSheetData } from '@/lib/sheets';
import { parseEvaluation } from '@/lib/scout-schemas';
import type { ScoutApiResponse, ScoutPlayer, SchemaType } from '@/types/scout';

export const dynamic = 'force-dynamic';

const VALID_SCHEMAS: SchemaType[] = ['Batsman', 'Fast Bowler', 'Spin Bowler'];

// Columns consumed by the scout system — everything else becomes extraInfo
const SYSTEM_COLUMNS = new Set([
  'Batch', 'Name', 'Div', 'Category', 'Schema',
  'Score', 'Pct', 'Rating', 'Remarks', 'Evaluation',
]);

function toSchemaType(raw: string): SchemaType {
  if (VALID_SCHEMAS.includes(raw as SchemaType)) return raw as SchemaType;
  return 'Batsman';
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sheetKey = url.searchParams.get('sheetKey') || 'tryout';

    const user = await requireAuth();
    const { headers, rows } = await readSheetData(sheetKey);

    const extraColumns = headers.filter((h) => !SYSTEM_COLUMNS.has(h));

    const players: ScoutPlayer[] = rows
      .map((row) => {
        const extraInfo: Record<string, string> = {};
        for (const col of extraColumns) {
          const val = String(row[col] ?? '').trim();
          if (val) extraInfo[col] = val;
        }

        return {
          rowIndex: row.__rowIndex as number,
          batch: String(row['Batch'] || '').trim(),
          name: String(row['Name'] || '').trim(),
          div: String(row['Div'] || '').trim(),
          category: String(row['Category'] || '').trim(),
          schema: toSchemaType(String(row['Schema'] || '')),
          score: Number(row['Score'] || 0),
          pct: Number(row['Pct'] || 0),
          rating: String(row['Rating'] || ''),
          remarks: String(row['Remarks'] || ''),
          evaluation: parseEvaluation(String(row['Evaluation'] || '')),
          extraInfo,
        };
      })
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
