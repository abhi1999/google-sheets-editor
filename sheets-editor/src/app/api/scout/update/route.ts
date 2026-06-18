import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { readSheetData, writeCellUpdates, appendAuditEntries, createAuditEntry } from '@/lib/sheets';
import type { ScoutUpdatePayload } from '@/types/scout';

export const dynamic = 'force-dynamic';

const SCOUT_COLUMNS = ['Evaluation', 'Score', 'Pct', 'Rating', 'Remarks'];

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sheetKey = url.searchParams.get('sheetKey') || 'tryout';

    const user = await requireAuth();

    const body = (await request.json()) as ScoutUpdatePayload;

    if (typeof body.rowIndex !== 'number' || body.rowIndex < 2) {
      return NextResponse.json({ error: 'Invalid row index' }, { status: 400 });
    }
    if (!body.evaluation || typeof body.evaluation !== 'object') {
      return NextResponse.json({ error: 'Invalid evaluation data' }, { status: 400 });
    }

    const { headers, rows } = await readSheetData(sheetKey);

    // Auto-append any missing scout columns to the header row
    const missingCols = SCOUT_COLUMNS.filter((col) => !headers.includes(col));
    if (missingCols.length > 0) {
      await writeCellUpdates(
        missingCols.map((col, i) => ({
          rowIndex: 1,
          columnIndex: headers.length + i,
          value: col,
        })),
        sheetKey
      );
      missingCols.forEach((col) => headers.push(col));
    }

    const fieldValues: Record<string, string> = {
      Evaluation: JSON.stringify(body.evaluation),
      Score: String(body.score),
      Pct: String(body.pct),
      Rating: body.rating,
      Remarks: body.remarks,
    };

    const updates = SCOUT_COLUMNS.map((col) => ({
      rowIndex: body.rowIndex,
      columnIndex: headers.indexOf(col),
      value: fieldValues[col],
    }));

    await writeCellUpdates(updates, sheetKey);

    // Capture old values for audit log (from the row we read above)
    const existingRow = rows.find((r) => r.__rowIndex === body.rowIndex);

    const auditEntries = SCOUT_COLUMNS
      .filter((col) => headers.includes(col))
      .map((col) =>
        createAuditEntry(
          user.email,
          user.name,
          body.rowIndex,
          col,
          String(existingRow?.[col] ?? ''),
          fieldValues[col],
          'success'
        )
      );

    appendAuditEntries(auditEntries, sheetKey).catch((err) => {
      console.error('[Scout Audit] Failed to write audit log:', err);
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[POST /api/scout/update]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save evaluation' },
      { status: 500 }
    );
  }
}
