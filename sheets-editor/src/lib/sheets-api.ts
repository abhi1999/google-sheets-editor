import { google, sheets_v4 } from 'googleapis';
import { getServiceAccountKey } from '@/lib/service-account';

export interface ReadSheetResult {
  headers: string[];
  rows: Array<{ __rowIndex: number; [key: string]: string | number }>;
}

let _sheetsClient: sheets_v4.Sheets | null = null;

function getSheetsClient(): sheets_v4.Sheets {
  if (_sheetsClient) return _sheetsClient;

  const credentials = getServiceAccountKey() as any;
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  _sheetsClient = google.sheets({ version: 'v4', auth });
  return _sheetsClient;
}

export async function sheetExists(spreadsheetId: string, sheetName: string): Promise<boolean> {
  const sheets = getSheetsClient();
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = spreadsheet.data.sheets?.map((s) => s.properties?.title) || [];
  return existingSheets.includes(sheetName);
}

export async function readSheetByName(
  spreadsheetId: string,
  sheetName: string,
  range?: string
): Promise<ReadSheetResult> {
  const sheets = getSheetsClient();
  const fullRange = range ? `${sheetName}!${range}` : `${sheetName}!A1:Z1000`;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: fullRange,
  });

  const values = response.data.values || [];
  if (values.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = values[0].map(String);
  const rows = values.slice(1).map((row, i) => {
    const obj: { __rowIndex: number; [key: string]: string | number } = { __rowIndex: i + 2 };
    headers.forEach((header, colIdx) => {
      obj[header] = row[colIdx] ?? '';
    });
    return obj;
  });

  return { headers, rows };
}
