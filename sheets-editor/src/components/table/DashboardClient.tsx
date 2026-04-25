'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { signOut } from 'next-auth/react';
import type {
  AppUser, SheetData, SheetRow, CellEdit,
  FilterState, SortState, PredefinedFilter
} from '@/types';
import { DataTable } from './DataTable';
import { Pagination } from './Pagination';
import { Toolbar } from './Toolbar';
import { BulkEditModal } from './BulkEditModal';
import { AuditPanel } from './AuditPanel';
import { FilterBar } from '@/components/filters/FilterBar';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

interface DashboardClientProps {
  user: AppUser;
  editableColumns: string[];
}

// ----------------------------------------------------------------
// Predefined filters — extend this list freely
// ----------------------------------------------------------------
const PREDEFINED_FILTERS: PredefinedFilter[] = [
  // Examples — customize to match your actual sheet columns:
  { id: 'Week2-Sat', label: 'Week2-Sat', column: 'Date', value: '04/25/2026', color: 'green' },
  { id: 'Week2-Sun', label: 'Week2-Sun', column: 'Date', value: '04/26/2026', color: 'green' },
  // { id: 'pending', label: 'Pending', column: 'Status', value: 'Pending', color: 'yellow' },
   { id: 'u13a', label: 'U13A', column: 'Cat', value: 'U13A', color: 'blue' },
   { id: 'u13b', label: 'U13B', column: 'Cat', value: 'U13B', color: 'blue' },
   { id: 'u15a', label: 'U15A', column: 'Cat', value: 'U15A', color: 'yellow' },
   { id: 'u15b', label: 'U15B', column: 'Cat', value: 'U15B', color: 'yellow' }
];

const DEFAULT_PAGE_SIZE = 25;

export function DashboardClient({ user, editableColumns }: DashboardClientProps) {
  const { toast } = useToast();

  // ── Data state ──────────────────────────────────────────────
  const [sheetData, setSheetData] = useState<SheetData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Edit state ───────────────────────────────────────────────
  const [pendingEdits, setPendingEdits] = useState<Map<string, CellEdit>>(new Map());
  const [isSaving, setIsSaving] = useState(false);

  // ── Selection ────────────────────────────────────────────────
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // ── Filter & sort ────────────────────────────────────────────
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    column: null,
    predefined: null,
  });
  const [sortState, setSortState] = useState<SortState>({ column: null, direction: null });

  // ── Pagination ───────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // ── UI state ─────────────────────────────────────────────────
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  // ── Fetch data ───────────────────────────────────────────────
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sheets');
      if (res.status === 401) { await signOut({ callbackUrl: '/login' }); return; }
      if (!res.ok) throw new Error(`Failed to load data (${res.status})`);
      const data: SheetData = await res.json();
      setSheetData(data);
      if (!silent) setPendingEdits(new Map()); // clear edits on full reload
    } catch (err: any) {
      setError(err.message || 'Unknown error');
      if (!silent) toast(err.message || 'Failed to load sheet data', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived: filtered + sorted + paginated rows ──────────────
  const processedRows = useMemo(() => {
    if (!sheetData) return [];
    let rows = sheetData.rows;

    // Apply pending edits to rows for display
    rows = rows.map((row) => {
      const updated = { ...row };
      pendingEdits.forEach((edit) => {
        if (edit.rowIndex === row.__rowIndex) {
          updated[edit.column] = edit.newValue;
        }
      });
      return updated;
    });

    // Search filter
    if (filters.search) {
      const lower = filters.search.toLowerCase();
      rows = rows.filter((row) =>
        Object.entries(row)
          .filter(([k]) => k !== '__rowIndex')
          .some(([, v]) => String(v).toLowerCase().includes(lower))
      );
    }

    // Column filter (from predefined or manual)
    if (filters.column) {
      const filterVal = filters[filters.column];
      if (filterVal) {
        rows = rows.filter((row) =>
          String(row[filters.column!] || '').toLowerCase() === filterVal.toLowerCase()
        );
      }
    }

    // Sort
    if (sortState.column && sortState.direction) {
      rows = [...rows].sort((a, b) => {
        const aVal = String(a[sortState.column!] || '');
        const bVal = String(b[sortState.column!] || '');
        const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
        return sortState.direction === 'desc' ? -cmp : cmp;
      });
    }

    return rows;
  }, [sheetData, filters, sortState, pendingEdits]);

  const totalPages = Math.max(1, Math.ceil(processedRows.length / pageSize));
  const paginatedRows = useMemo(
    () => processedRows.slice((page - 1) * pageSize, page * pageSize),
    [processedRows, page, pageSize]
  );

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [filters, sortState]);

  // ── Handlers ─────────────────────────────────────────────────
  const handleSort = (column: string) => {
    setSortState((prev) => {
      if (prev.column === column) {
        if (prev.direction === 'asc') return { column, direction: 'desc' };
        if (prev.direction === 'desc') return { column: null, direction: null };
      }
      return { column, direction: 'asc' };
    });
  };

  const handleCellEdit = useCallback((edit: CellEdit) => {
    const key = `${edit.rowIndex}:${edit.column}`;
    setPendingEdits((prev) => {
      const next = new Map(prev);
      if (edit.newValue === edit.oldValue) {
        next.delete(key);
      } else {
        next.set(key, edit);
      }
      return next;
    });
  }, []);

  const handleSelectRow = useCallback((rowIndex: number, checked: boolean) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (checked) next.add(rowIndex); else next.delete(rowIndex);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectedRows(checked ? new Set(paginatedRows.map((r) => r.__rowIndex)) : new Set());
  }, [paginatedRows]);

  const handleSave = async () => {
    if (pendingEdits.size === 0 || isSaving) return;
    setIsSaving(true);

    try {
      const edits = Array.from(pendingEdits.values());
      const res = await fetch('/api/sheets/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edits }),
      });

      if (res.status === 401) { await signOut({ callbackUrl: '/login' }); return; }
      if (res.status === 403) {
        toast('Permission denied — you are not an editor', 'error');
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      setPendingEdits(new Map());
      toast(`Saved ${data.updatedCount} change${data.updatedCount !== 1 ? 's' : ''} successfully`, 'success');
      // Refresh data silently
      fetchData(true);
    } catch (err: any) {
      toast(err.message || 'Failed to save changes', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setPendingEdits(new Map());
    toast('Changes discarded', 'info');
  };

  const handleBulkApply = (column: string, value: string) => {
    if (!sheetData) return;
    const newEdits = new Map(pendingEdits);
    let count = 0;
    selectedRows.forEach((rowIndex) => {
      const row = sheetData.rows.find((r) => r.__rowIndex === rowIndex);
      if (!row) return;
      const key = `${rowIndex}:${column}`;
      const oldValue = String(row[column] ?? '');
      if (value !== oldValue) {
        newEdits.set(key, { rowIndex, column, oldValue, newValue: value });
        count++;
      }
    });
    setPendingEdits(newEdits);
    toast(`Staged ${count} bulk change${count !== 1 ? 's' : ''} — save to apply`, 'info');
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.column) params.set('filterColumn', filters.column);
    if (filters.column && filters[filters.column]) params.set('filterValue', filters[filters.column] as string);
    if (sortState.column) { params.set('sortColumn', sortState.column); params.set('sortDirection', sortState.direction || 'asc'); }
    window.location.href = `/api/export?${params}`;
    toast('Downloading CSV…', 'info');
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <Toolbar
        user={user}
        pendingCount={pendingEdits.size}
        selectedCount={selectedRows.size}
        isSaving={isSaving}
        isLoading={isLoading}
        filters={filters}
        sortState={sortState}
        onSave={handleSave}
        onDiscard={handleDiscard}
        onRefresh={() => fetchData()}
        onExport={handleExport}
        onBulkEdit={() => setShowBulkEdit(true)}
        onSignOut={() => signOut({ callbackUrl: '/login' })}
      />

      <main className="max-w-screen-2xl mx-auto px-4 py-5 space-y-4">
        {/* Status bar for read-only users */}
        {!user.isEditor && (
          <div
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
              <circle cx="7" cy="7" r="5.5" />
              <line x1="7" y1="6" x2="7" y2="10" strokeLinecap="round" />
              <circle cx="7" cy="4.5" r="0.5" fill="currentColor" />
            </svg>
            You have <strong>read-only access</strong>. Contact an admin to request editor permissions.
          </div>
        )}

        {/* Filter bar */}
        {sheetData && (
          <FilterBar
            headers={sheetData.headers}
            filters={filters}
            onFiltersChange={setFilters}
            predefinedFilters={PREDEFINED_FILTERS}
            totalRows={sheetData.rows.length}
            filteredRows={processedRows.length}
          />
        )}

        {/* Legend */}
        {user.isEditor && editableColumns.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--editable)' }} />
              Editable columns: {editableColumns.join(', ')}
            </div>
            <span>·</span>
            <span>Double-click a cell to edit</span>
            <span>·</span>
            <span>Enter to confirm · Esc to cancel</span>
            <button
              onClick={() => setShowAudit(true)}
              className="ml-auto flex items-center gap-1 hover:opacity-80 transition-opacity"
              style={{ color: 'var(--accent-bright)' }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 1h8v10H2V1z" />
                <line x1="4" y1="4" x2="8" y2="4" />
                <line x1="4" y1="6.5" x2="8" y2="6.5" />
                <line x1="4" y1="9" x2="6" y2="9" />
              </svg>
              View audit log
            </button>
          </div>
        )}

        {/* Main table card */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          {error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="mb-3 text-4xl">⚠</div>
              <p className="font-medium mb-1" style={{ color: 'var(--danger)' }}>Failed to load data</p>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{error}</p>
              <button
                onClick={() => fetchData()}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                Try again
              </button>
            </div>
          ) : isLoading ? (
            <TableSkeleton rows={pageSize} cols={5} />
          ) : sheetData ? (
            <>
              <DataTable
                headers={sheetData.headers}
                rows={paginatedRows}
                editableColumns={editableColumns}
                isEditor={user.isEditor}
                selectedRows={selectedRows}
                onSelectRow={handleSelectRow}
                onSelectAll={handleSelectAll}
                sortState={sortState}
                onSort={handleSort}
                pendingEdits={pendingEdits}
                onCellEdit={handleCellEdit}
                page={page}
                pageSize={pageSize}
              />
              <div className="px-4" style={{ borderTop: '1px solid var(--border)' }}>
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalRows={processedRows.length}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="text-center text-xs pb-4" style={{ color: 'var(--text-muted)' }}>
          {sheetData && (
            <span>Last fetched: {new Date(sheetData.lastFetched).toLocaleTimeString()}</span>
          )}
        </div>
      </main>

      {/* Modals */}
      {showBulkEdit && user.isEditor && (
        <BulkEditModal
          selectedCount={selectedRows.size}
          editableColumns={editableColumns}
          onApply={handleBulkApply}
          onClose={() => setShowBulkEdit(false)}
        />
      )}

      <AuditPanel
        isOpen={showAudit}
        onClose={() => setShowAudit(false)}
      />
    </div>
  );
}
