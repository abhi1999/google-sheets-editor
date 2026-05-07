/**
 * Centralized application configuration.
 * Reads from environment variables and optional JSON config files.
 * This module runs SERVER-SIDE only.
 */

import fs from 'fs';
import path from 'path';
import { readSheetByName, sheetExists } from '@/lib/sheets';

// ============================================================
// Permission Configuration
// ============================================================

/**
 * Load the editor allowlist from environment variable, JSON config file, or Google Sheet.
 * Priority: EDITOR_EMAILS env var > EDITORS_CONFIG_PATH > EditAccess sheet > empty list
 */
async function loadEditorEmails(): Promise<Set<string>> {
  const emails = new Set<string>();

  // Option A: Comma-separated env var
  if (process.env.EDITOR_EMAILS) {
    const envEmails = process.env.EDITOR_EMAILS
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    envEmails.forEach(email => emails.add(email));
  }

  // Option B: JSON config file
  const configPath = process.env.EDITORS_CONFIG_PATH || './editors.json';
  try {
    const absolutePath = path.resolve(process.cwd(), configPath);
    if (fs.existsSync(absolutePath)) {
      const raw = fs.readFileSync(absolutePath, 'utf-8');
      const parsed = JSON.parse(raw) as { editors: string[] };
      const jsonEmails = (parsed.editors || [])
        .map((e: string) => e.trim().toLowerCase())
        .filter(Boolean);
      jsonEmails.forEach(email => emails.add(email));
    }
  } catch (err) {
    console.warn('[Config] Could not load editors config file:', err);
  }

  // Option C: EditAccess sheet
  if (await sheetExists('EditAccess')) {
    try {
      const sheetData = await readSheetByName('EditAccess');
      // Assume the sheet has a column named 'Email' or the first column contains emails
      const emailColumn = sheetData.headers.includes('Email') ? 'Email' : sheetData.headers[0];
      if (emailColumn) {
        sheetData.rows.forEach(row => {
          const email = String(row[emailColumn] || '').trim().toLowerCase();
          if (email && email.includes('@')) { // Basic email validation
            emails.add(email);
          }
        });
      }
    } catch (err) {
      console.warn('[Config] Could not load editors from EditAccess sheet:', err);
    }
  } else {
    console.info('[Config] EditAccess sheet not found, skipping sheet-based editor configuration');
  }

  if (emails.size === 0) {
    console.warn('[Config] No editor allowlist configured — no one will have edit access.');
  }

  return emails;
}

// Cache after first load (module-level singleton)
let _editorEmails: Set<string> | null = null;
let _editorEmailsPromise: Promise<Set<string>> | null = null;

export async function getEditorEmails(): Promise<Set<string>> {
  if (_editorEmails) return _editorEmails;
  if (_editorEmailsPromise) return _editorEmailsPromise;

  _editorEmailsPromise = loadEditorEmails();
  _editorEmails = await _editorEmailsPromise;
  return _editorEmails;
}

export async function isEditor(email: string): Promise<boolean> {
  const emails = await getEditorEmails();
  return emails.has(email.toLowerCase());
}

// ============================================================
// Google Sheets Configuration
// ============================================================

export interface SheetsConfig {
  sheetId: string;
  range: string;
  auditSheetName: string;
  editableColumns: string[];
}

export function getSheetsConfig(): SheetsConfig {
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) throw new Error('SHEET_ID environment variable is required');

  return {
    sheetId,
    range: process.env.SHEET_RANGE || 'Sheet1!A1:Z1000',
    auditSheetName: process.env.AUDIT_SHEET_NAME || 'AuditLog',
    editableColumns: (process.env.EDITABLE_COLUMNS || '').replace(/\\n/g, '\n')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean),
  };
}

// ============================================================
// App Settings
// ============================================================

export interface AppSettings {
  pageSize: number;
  autoSave: boolean;
}

export function getAppSettings(): AppSettings {
  return {
    pageSize: parseInt(process.env.PAGE_SIZE || '25', 10),
    autoSave: process.env.AUTO_SAVE === 'true',
  };
}

// ============================================================
// Service Account
// ============================================================

export function getServiceAccountKey(): object {
  // Option A: JSON string in env var
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    } catch {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON');
    }
  }

  // Option B: Path to key file
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (keyPath) {
    const absolutePath = path.resolve(process.cwd(), keyPath);
    if (fs.existsSync(absolutePath)) {
      const raw = fs.readFileSync(absolutePath, 'utf-8');
      return JSON.parse(raw);
    }
    throw new Error(`Service account key file not found: ${absolutePath}`);
  }

  throw new Error(
    'Google service account credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_KEY_PATH.'
  );
}
