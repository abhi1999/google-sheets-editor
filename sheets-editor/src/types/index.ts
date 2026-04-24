// ============================================================
// Core Data Types
// ============================================================

export interface SheetRow {
  __rowIndex: number; // 1-based row index in the sheet (accounts for header)
  [key: string]: string | number;
}

export interface SheetData {
  headers: string[];
  rows: SheetRow[];
  editableColumns: string[];
  lastFetched: string;
}

export interface CellEdit {
  rowIndex: number;
  column: string;
  oldValue: string;
  newValue: string;
}

export interface BatchEditPayload {
  edits: CellEdit[];
}

export interface BatchEditResult {
  success: boolean;
  updatedCount: number;
  errors: string[];
  auditIds: string[];
}

// ============================================================
// Audit Log Types
// ============================================================

export interface AuditEntry {
  id: string;
  timestamp: string;
  userEmail: string;
  userName: string;
  rowIndex: number;
  column: string;
  oldValue: string;
  newValue: string;
  status: 'success' | 'error';
}

// ============================================================
// Auth Types
// ============================================================

export interface AppUser {
  email: string;
  name: string;
  image?: string;
  isEditor: boolean;
}

// ============================================================
// Filter & Sort Types
// ============================================================

export type SortDirection = 'asc' | 'desc' | null;

export interface SortState {
  column: string | null;
  direction: SortDirection;
}

export interface FilterState {
  search: string;
  column: string | null;
  predefined: string | null;
  [key: string]: string | null;
}

export interface PredefinedFilter {
  id: string;
  label: string;
  column: string;
  value: string;
  color?: string;
}

// ============================================================
// API Response Types
// ============================================================

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
