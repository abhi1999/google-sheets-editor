/**
 * Google Sheets API service.
 * All interactions with the Sheets API go through this module.
 * Uses a Service Account for server-side authentication.
 */

import { google, sheets_v4 } from 'googleapis';
import { getServiceAccountKey, getSheetsConfig } from '@/config';
import type { SheetRow, AuditEntry } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// Auth Client (singleton)
// ============================================================

let _sheets: sheets_v4.Sheets | null = null;

function getSheetsClient(): sheets_v4.Sheets {
  if (_sheets) return _sheets;

  const credentials = getServiceAccountKey() as any;
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  _sheets = google.sheets({ version: 'v4', auth });
  return _sheets;
}

// ============================================================
// Read Sheet Data
// ============================================================

export interface ReadSheetResult {
  headers: string[];
  rows: SheetRow[];
}

export async function readSheetData(): Promise<ReadSheetResult> {
  const sheets = getSheetsClient();
  const config = getSheetsConfig();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.sheetId,
    range: config.range,
  });

  const values = response.data.values || [];
  if (values.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = values[0].map(String);
  const rows: SheetRow[] = values.slice(1).map((row, i) => {
    const obj: SheetRow = { __rowIndex: i + 2 }; // +2: 1-based + skip header
    headers.forEach((header, colIdx) => {
      obj[header] = row[colIdx] ?? '';
    });
    return obj;
  });

  return { headers, rows };
}

// ============================================================
// Write Cell Updates
// ============================================================

export interface CellUpdateInput {
  rowIndex: number; // 1-based row in sheet
  columnIndex: number; // 0-based column index
  value: string;
}

export async function writeCellUpdates(updates: CellUpdateInput[]): Promise<void> {
  if (updates.length === 0) return;

  const sheets = getSheetsClient();
  const config = getSheetsConfig();

  // Build batch update data
  // Extract sheet name from range (e.g., "Sheet1!A1:Z1000" -> "Sheet1")
  const sheetName = config.range.includes('!')
    ? config.range.split('!')[0]
    : 'Sheet1';

  const data: sheets_v4.Schema$ValueRange[] = updates.map((update) => {
    // Convert 0-based column index to A1 notation letter
    const colLetter = columnIndexToLetter(update.columnIndex);
    const rangeNotation = `${sheetName}!${colLetter}${update.rowIndex}`;

    return {
      range: rangeNotation,
      values: [[update.value]],
    };
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: config.sheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data,
    },
  });
}

// ============================================================
// Audit Log
// ============================================================

/**
 * Ensure the audit log sheet exists, creating it with headers if needed.
 */
export async function ensureAuditSheet(): Promise<void> {
  const sheets = getSheetsClient();
  const config = getSheetsConfig();

  // Get existing sheets
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: config.sheetId,
  });

  const existingSheets = spreadsheet.data.sheets?.map(
    (s) => s.properties?.title
  ) || [];

  if (!existingSheets.includes(config.auditSheetName)) {
    // Create the audit sheet
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: config.sheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: config.auditSheetName,
              },
            },
          },
        ],
      },
    });

    // Add headers
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.sheetId,
      range: `${config.auditSheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          'ID', 'Timestamp', 'User Email', 'User Name',
          'Row Index', 'Column', 'Old Value', 'New Value', 'Status'
        ]],
      },
    });
  }
}

/**
 * Append audit log entries to the audit sheet.
 */
export async function appendAuditEntries(entries: AuditEntry[]): Promise<void> {
  if (entries.length === 0) return;

  const sheets = getSheetsClient();
  const config = getSheetsConfig();

  await ensureAuditSheet();

  const rows = entries.map((entry) => [
    entry.id,
    entry.timestamp,
    entry.userEmail,
    entry.userName,
    entry.rowIndex,
    entry.column,
    entry.oldValue,
    entry.newValue,
    entry.status,
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.sheetId,
    range: `${config.auditSheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: rows,
    },
  });
}

// ============================================================
// Helpers
// ============================================================

/**
 * Convert 0-based column index to spreadsheet column letter (A, B, ..., Z, AA, AB, ...)
 */
export function columnIndexToLetter(index: number): string {
  let letter = '';
  let n = index + 1;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

/**
 * Create a new audit entry object.
 */
export function createAuditEntry(
  userEmail: string,
  userName: string,
  rowIndex: number,
  column: string,
  oldValue: string,
  newValue: string,
  status: 'success' | 'error' = 'success'
): AuditEntry {
  return {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    userEmail,
    userName,
    rowIndex,
    column,
    oldValue,
    newValue,
    status,
  };
}
