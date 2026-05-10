/**
 * Centralized application configuration.
 * Reads from environment variables, optional JSON config files, and sheet-specific settings.
 * This module runs SERVER-SIDE only.
 */

import fs from 'fs';
import path from 'path';
import type { PredefinedFilter } from '@/types';
import { readSheetByName, sheetExists } from '@/lib/sheets-api';
import bundledSheetsConfig from '../../sheets-config.json';

const SHEETS_CONFIG_PATH = process.env.SHEETS_CONFIG_PATH || './sheets-config.json';
const EDITORS_CONFIG_PATH = process.env.EDITORS_CONFIG_PATH || './editors.json';

export interface SheetConfig {
  id: string;
  name: string;
  description?: string;
  sheetId: string;
  range?: string;
  auditSheetName?: string;
  editableColumns?: string[];
  editorEmails?: string[];
  predefinedFilters?: PredefinedFilter[];
  useEditAccessSheet?: boolean;
}

export interface SheetOption {
  id: string;
  name: string;
  description?: string;
}

export interface SheetsConfig {
  sheetKey: string;
  sheetName: string;
  sheetDescription?: string;
  sheetId: string;
  range: string;
  auditSheetName: string;
  editableColumns: string[];
  predefinedFilters: PredefinedFilter[];
  editorEmails: string[];
  useEditAccessSheet?: boolean;
}

interface SheetsConfigFile {
  defaultSheetId?: string;
  sheets: SheetConfig[];
}

let cachedConfigFile: SheetsConfigFile | null | undefined;
let cachedEditorEmails: Map<string, Promise<Set<string>>> = new Map();

function resolveConfigFilePath(relativePath: string): string | null {
  const candidates = [
    path.resolve(process.cwd(), relativePath),
    path.resolve(process.cwd(), 'public', relativePath),
    path.resolve(process.cwd(), 'public', path.basename(relativePath)),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function loadConfigFile(): SheetsConfigFile | null {
  if (cachedConfigFile !== undefined) return cachedConfigFile;
  console.log('loadConfigFile called, checking path:', SHEETS_CONFIG_PATH);
  const absolutePath = resolveConfigFilePath(SHEETS_CONFIG_PATH);

  if (!absolutePath) {
    const defaultConfigRequested = SHEETS_CONFIG_PATH === './sheets-config.json' || SHEETS_CONFIG_PATH === 'sheets-config.json';
    if (defaultConfigRequested && bundledSheetsConfig) {
      console.log('Using bundled sheets config from import.');
      return (cachedConfigFile = {
        defaultSheetId: bundledSheetsConfig.defaultSheetId,
        sheets: Array.isArray(bundledSheetsConfig.sheets) ? bundledSheetsConfig.sheets : [],
      });
    }

    console.warn(`[Config] No config file found for ${SHEETS_CONFIG_PATH}. Falling back to environment variables.`);
    return (cachedConfigFile = null);
  }

  console.log('Config file found at:', absolutePath);
  try {
    const raw = fs.readFileSync(absolutePath, 'utf-8');
    const parsed = JSON.parse(raw) as SheetsConfigFile;
    return (cachedConfigFile = {
      defaultSheetId: parsed.defaultSheetId,
      sheets: Array.isArray(parsed.sheets) ? parsed.sheets : [],
    });
  } catch (error) {
    console.warn('[Config] Could not load sheets config file:', error);
    return (cachedConfigFile = null);
  }
}

export function getAllSheetOptions(): SheetOption[] {
  const configFile = loadConfigFile();
  if (configFile && configFile.sheets.length > 0) {
    return configFile.sheets.map((sheet) => ({
      id: sheet.id,
      name: sheet.name,
      description: sheet.description,
    }));
  }

  return [
    {
      id: 'default',
      name: 'Default sheet',
      description: 'Single-sheet mode using environment variables',
    },
  ];
}

export function getDefaultSheetId(): string {
  const configFile = loadConfigFile();
  if (configFile && configFile.sheets.length > 0) {
    const defaultId = configFile.defaultSheetId;
    const validDefault = typeof defaultId === 'string' && configFile.sheets.some((sheet) => sheet.id === defaultId);
    return validDefault ? defaultId : configFile.sheets[0].id;
  }
  return 'default';
}

function normalizeSheetConfig(config: SheetConfig): SheetsConfig {
  return {
    sheetKey: config.id,
    sheetName: config.name,
    sheetDescription: config.description,
    sheetId: config.sheetId,
    range: config.range || 'Sheet1!A1:Z1000',
    auditSheetName: config.auditSheetName || 'AuditLog',
    editableColumns: (config.editableColumns || []).map((c) => c.trim()).filter(Boolean),
    predefinedFilters: config.predefinedFilters || [],
    editorEmails: (config.editorEmails || []).map((e) => e.trim().toLowerCase()).filter(Boolean),
  };
}

export function getSheetsConfig(sheetKey?: string): SheetsConfig {
  const configFile = loadConfigFile();
  if (configFile && configFile.sheets.length > 0) {
    const selectedSheet = sheetKey
      ? configFile.sheets.find((sheet) => sheet.id === sheetKey)
      : undefined;
    const fallbackSheet = configFile.sheets.find((sheet) => sheet.id === configFile.defaultSheetId) || configFile.sheets[0];
    return normalizeSheetConfig(selectedSheet || fallbackSheet);
  }

  const sheetId = process.env.SHEET_ID;
  if (!sheetId) {
    throw new Error('SHEET_ID environment variable is required when no sheets-config.json is provided');
  }

  const editableColumns = (process.env.EDITABLE_COLUMNS || '')
    .replace(/\n/g, '\n')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);

  return {
    sheetKey: 'default',
    sheetName: process.env.SHEET_NAME || 'Default sheet',
    sheetDescription: process.env.SHEET_DESCRIPTION || 'Default sheet configuration',
    sheetId,
    range: process.env.SHEET_RANGE || 'Sheet1!A1:Z1000',
    auditSheetName: process.env.AUDIT_SHEET_NAME || 'AuditLog',
    editableColumns,
    predefinedFilters: [],
    editorEmails: [],
  };
}

async function loadEditorEmails(sheetKey?: string): Promise<Set<string>> {
  const emails = new Set<string>();

  if (process.env.EDITOR_EMAILS) {
    process.env.EDITOR_EMAILS.split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .forEach((email) => emails.add(email));
  }

  try {
    const absolutePath = resolveConfigFilePath(EDITORS_CONFIG_PATH);
    if (absolutePath) {
      const raw = fs.readFileSync(absolutePath, 'utf-8');
      const parsed = JSON.parse(raw) as { editors?: string[] };
      (parsed.editors || [])
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
        .forEach((email) => emails.add(email));
    }
  } catch (error) {
    console.warn('[Config] Could not load editors config file:', error);
  }

  try {
    const sheetConfig = getSheetsConfig(sheetKey);
    sheetConfig.editorEmails.forEach((email) => emails.add(email));

    if (sheetConfig.sheetId && sheetConfig.sheetKey) {
      const useSheet = sheetConfig.useEditAccessSheet !== false;
      if (useSheet && (await sheetExists(sheetConfig.sheetId, 'EditAccess'))) {
        try {
          const sheetData = await readSheetByName(sheetConfig.sheetId, 'EditAccess');
          const emailColumn = sheetData.headers.includes('Email') ? 'Email' : sheetData.headers[0];
          if (emailColumn) {
            sheetData.rows.forEach((row) => {
              const email = String(row[emailColumn] || '').trim().toLowerCase();
              if (email && email.includes('@')) {
                emails.add(email);
              }
            });
          }
        } catch (error) {
          console.warn('[Config] Could not load editors from EditAccess sheet:', error);
        }
      }
    }
  } catch (error) {
    console.warn('[Config] Could not load editor emails for sheet:', error);
  }

  if (emails.size === 0) {
    console.warn('[Config] No editor allowlist configured — no one will have edit access.');
  }

  return emails;
}

export async function getEditorEmails(sheetKey?: string): Promise<Set<string>> {
  const cacheKey = sheetKey || getDefaultSheetId();
  if (cachedEditorEmails.has(cacheKey)) {
    return cachedEditorEmails.get(cacheKey)!;
  }

  const promise = loadEditorEmails(sheetKey);
  cachedEditorEmails.set(cacheKey, promise);
  return promise;
}

export async function isEditor(email: string, sheetKey?: string): Promise<boolean> {
  const emails = await getEditorEmails(sheetKey);
  return emails.has(email.toLowerCase());
}

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
