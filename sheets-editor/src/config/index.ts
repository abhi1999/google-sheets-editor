/**
 * Centralized application configuration.
 * Reads from environment variables and optional JSON config files.
 * This module runs SERVER-SIDE only.
 */

import fs from 'fs';
import path from 'path';

// ============================================================
// Permission Configuration
// ============================================================

/**
 * Load the editor allowlist from environment variable or JSON config file.
 * Priority: EDITOR_EMAILS env var > EDITORS_CONFIG_PATH > empty list
 */
function loadEditorEmails(): Set<string> {
  // Option A: Comma-separated env var
  if (process.env.EDITOR_EMAILS) {
    const emails = process.env.EDITOR_EMAILS
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    return new Set(emails);
  }

  // Option B: JSON config file
  const configPath = process.env.EDITORS_CONFIG_PATH || './editors.json';
  try {
    const absolutePath = path.resolve(process.cwd(), configPath);
    if (fs.existsSync(absolutePath)) {
      const raw = fs.readFileSync(absolutePath, 'utf-8');
      const parsed = JSON.parse(raw) as { editors: string[] };
      const emails = (parsed.editors || [])
        .map((e: string) => e.trim().toLowerCase())
        .filter(Boolean);
      return new Set(emails);
    }
  } catch (err) {
    console.warn('[Config] Could not load editors config file:', err);
  }

  console.warn('[Config] No editor allowlist configured — no one will have edit access.');
  return new Set<string>();
}

// Cache after first load (module-level singleton)
let _editorEmails: Set<string> | null = null;

export function getEditorEmails(): Set<string> {
  if (!_editorEmails) {
    _editorEmails = loadEditorEmails();
  }
  return _editorEmails;
}

export function isEditor(email: string): boolean {
  return getEditorEmails().has(email.toLowerCase());
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
