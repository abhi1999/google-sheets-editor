import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSheetsConfig } from '@/config';

/**
 * GET /api/audit
 * Returns recent audit log entries. Requires authentication.
 */
export async function GET() {
  try {
    await requireAuth();

    // This is a simplified read of the audit sheet
    // In production you'd add pagination
    const config = getSheetsConfig();

    try {
      const { google } = await import('googleapis');
      const { getServiceAccountKey } = await import('@/config');

      const credentials = getServiceAccountKey() as any;
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
      const sheets = google.sheets({ version: 'v4', auth });

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: config.sheetId,
        range: `${config.auditSheetName}!A1:I200`,
      });

      const values = response.data.values || [];
      if (values.length <= 1) {
        return NextResponse.json({ entries: [] });
      }

      const headers = values[0];
      const entries = values.slice(1).map((row) => ({
        id: row[0] || '',
        timestamp: row[1] || '',
        userEmail: row[2] || '',
        userName: row[3] || '',
        rowIndex: row[4] || '',
        column: row[5] || '',
        oldValue: row[6] || '',
        newValue: row[7] || '',
        status: row[8] || '',
      })).reverse(); // Most recent first

      return NextResponse.json({ entries });
    } catch (sheetsError) {
      // Audit sheet may not exist yet
      return NextResponse.json({ entries: [] });
    }
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 });
  }
}
