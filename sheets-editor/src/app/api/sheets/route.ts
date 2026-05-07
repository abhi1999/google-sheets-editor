import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { readSheetData } from '@/lib/sheets';
import { getSheetsConfig } from '@/config';
import type { SheetData } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sheets
 * Returns sheet data. Requires authentication (read-only for non-editors).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sheetKey = url.searchParams.get('sheetKey') || undefined;

    const user = await requireAuth(sheetKey);
    const config = getSheetsConfig(sheetKey);
    const { headers, rows } = await readSheetData(sheetKey);

    const response: SheetData = {
      headers,
      rows,
      editableColumns: user.isEditor ? config.editableColumns : [],
      lastFetched: new Date().toISOString(),
      predefinedFilters: config.predefinedFilters,
      sheetKey: config.sheetKey,
      sheetName: config.sheetName,
      sheetDescription: config.sheetDescription,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[GET /api/sheets]', error);
    return NextResponse.json(
      { error: 'Failed to fetch sheet data' },
      { status: 500 }
    );
  }
}
