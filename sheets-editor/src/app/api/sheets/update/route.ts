import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth';
import { readSheetData, writeCellUpdates, appendAuditEntries, createAuditEntry } from '@/lib/sheets';
import { getSheetsConfig } from '@/config';
import type { BatchEditPayload, BatchEditResult } from '@/types';

/**
 * POST /api/sheets/update
 * Applies cell edits. Requires editor permission (enforced server-side).
 */
export async function POST(request: NextRequest) {
  try {
    // CRITICAL: Server-side permission enforcement
    const user = await requireEditor();

    const body = (await request.json()) as BatchEditPayload;

    if (!body.edits || !Array.isArray(body.edits) || body.edits.length === 0) {
      return NextResponse.json({ error: 'No edits provided' }, { status: 400 });
    }

    const config = getSheetsConfig();

    // Validate that all edited columns are in the allowlist
    const invalidColumns = body.edits.filter(
      (edit) => !config.editableColumns.includes(edit.column)
    );

    if (invalidColumns.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot edit restricted columns: ${invalidColumns.map((e) => e.column).join(', ')}`,
        },
        { status: 403 }
      );
    }

    // Validate row indices and values
    for (const edit of body.edits) {
      if (typeof edit.rowIndex !== 'number' || edit.rowIndex < 2) {
        return NextResponse.json(
          { error: `Invalid row index: ${edit.rowIndex}` },
          { status: 400 }
        );
      }
      if (typeof edit.newValue !== 'string') {
        return NextResponse.json(
          { error: 'New value must be a string' },
          { status: 400 }
        );
      }
    }

    // Read current data to get column indices and verify old values
    const { headers } = await readSheetData();

    const updates = body.edits.map((edit) => {
      const colIndex = headers.indexOf(edit.column);
      if (colIndex === -1) {
        throw new Error(`Column not found: ${edit.column}`);
      }
      return {
        rowIndex: edit.rowIndex,
        columnIndex: colIndex,
        value: edit.newValue,
      };
    });

    // Write to sheet
    await writeCellUpdates(updates);

    // Append audit log entries
    const auditEntries = body.edits.map((edit) =>
      createAuditEntry(
        user.email,
        user.name,
        edit.rowIndex,
        edit.column,
        edit.oldValue,
        edit.newValue,
        'success'
      )
    );

    // Fire-and-forget audit log (don't fail the request if audit fails)
    appendAuditEntries(auditEntries).catch((err) => {
      console.error('[Audit] Failed to write audit log:', err);
    });

    const result: BatchEditResult = {
      success: true,
      updatedCount: body.edits.length,
      errors: [],
      auditIds: auditEntries.map((e) => e.id),
    };

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[POST /api/sheets/update]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update sheet' },
      { status: 500 }
    );
  }
}
