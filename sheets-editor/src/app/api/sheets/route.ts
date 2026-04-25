import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { readSheetData } from '@/lib/sheets';
import { getSheetsConfig } from '@/config';
import type { SheetData } from '@/types';

/**
 * GET /api/sheets
 * Returns sheet data. Requires authentication (read-only for non-editors).
 */
export async function GET() {
  try {
    const user = await requireAuth();

    const config = getSheetsConfig();
    //console.log('iamhere config', config)
    const { headers, rows } = await readSheetData();
    //console.log('iamhere', headers)
    const response: SheetData = {
      headers,
      rows,
      editableColumns: user.isEditor ? config.editableColumns : [], // Non-editors get empty editable list
      lastFetched: new Date().toISOString(),
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
