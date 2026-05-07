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

const ACADEMY_TEAMS = [
  {
    "academy": "22 Yards",
    "teams": "22 Yards Strikers"
  },
  {
    "academy": "CCCA",
    "teams": "CCCA Panthers, CCCA Cubs, CCCA Jaguars, CCCA Cheetahs, CCCA Tigers, CCCA Pumas, CCCA U17, CCCA Lions"
  },
  {
    "academy": "Delhi Capitals",
    "teams": "Delhi Capitals Atomics, Delhi Capitals Dragons, Delhi Capitals Challengers, Delhi Capitals Raiders, Delhi Capitals Dominators, Delhi Capitals Giants, Delhi Capitals Jr. Blackcaps"
  },
  {
    "academy": "DC Drona Sports",
    "teams": "DreamCricket Drona Thunderbolts, DreamCricket Drona Elite"
  },
  {
    "academy": "DreamCricket",
    "teams": "DreamCricket Lightning, DreamCricket Tornado, DreamCricket Thunder, DreamCricket Whirlwind Girls, DreamCricket Blue Jays, DreamCricket Cubs, DreamCricket Dragons (Girls), DreamCricket Cheetahs, DreamCricket Colts Jr, DreamCricket Jaguars, DreamCricket Panthers, DreamCricket Leopards, DreamCricket Pumas, DreamCricket Warriors"
  },
  {
    "academy": "Drona Sports",
    "teams": "Drona Sports Apollo, Drona Sports Atlas, Drona Sports Aviators, Drona Sports Asteroids, Drona Sports Comets, Drona Sports Centaurus, Drona Sports Cosmos, Drona Sports Quasars, Drona Archers"
  },
  {
    "academy": "Falcons",
    "teams": "FJSC Titans, FJSC Supergiants, FJSC Blazers"
  },
  {
    "academy": "Gameday",
    "teams": "Gameday Stars, Gameday Bears, Gameday Warriors, Gameday Trailblazers, Gameday SuperStrikers, Gameday Renegades, Gameday Avengers, Gameday Firebirds, Gameday Lions,Gameday U11 A, Gameday U15A,Gameday U15B - Team 1,Gameday U15B - Team 2,Gameday U13A Team 2, Gameday U13A Team 1"
  },
  {
    "academy": "ICUSA",
    "teams": "ICUSA Parsippany Generals, ICUSA Sons Of Liberty, ICUSA Black Mambas"
  },
  {
    "academy": "Jersey Titans",
    "teams": "Jersey Titans Atlas, Jersey Titans Knights, Jersey Titans Defenders, Jersey Titans Cronus, Jersey Titans Guardians, Jersey Titans Phoenix, Jersey Titans Destroyers, Jersey Titans Gladiators, Jersey Titans Spartans, Jersey Titans Helios, Jersey Titans Warriors, Jersey Titans Crusaders, Jersey Titans Lapetus"
  },
  {
    "academy": "KCR",
    "teams": "KCR Cobras, KCR Pythons, KCR Dare Devils, KCR TrailBlazers, KCR Raptors, KCR Knights"
  },
  {
    "academy": "Knight Riders",
    "teams": "KRA Eagles, KRA Hawks, KRA Phoenix, KRA Cardinals, KRA Jersey City Blue Jays, KRA Tigers, KRA Cheetahs, KRA Lions, KRA Leopards, KRA Panthers, KRA Destroyers, KRA Crushers, KRA Rangers, KRA Challengers, Cricmax Dominators, KRA Knights"
  }, 
  {
    "academy": "NJ Royals",
    "teams": "NJ Royal Blazers, NJ Royal Titans, NJRoyal Mavericks"
  },
  {
    "academy": "Princeton Cricket Club",
    "teams": "Princeton Yodhas U13, Princeton Yodhas U15"
  },
  {
    "academy": "RRA NJ",
    "teams": "RRA NJ Comets, RRA NJ Astros, RRA NJ Nebula, RRA NJ Apex, RRA NJ Asteroids, RRA NJ Supergiants, RRA NJ Supernovas, RRA NJ Superstrikers, RRA SuperStars, RRA NJ Superpulsers, RRA SuperRadients, RRA NJ Orions, RRA NJ Lynx, RRA NJ Solaris, RRA NJ - Phoenix, RRA NJ Polaris, RRA NJ - COSMOS, RRA NJ - GALAXY, RRA NJ - UNIVERSE"
  },
  {
    "academy": "Rising Stars",
    "teams": "Rising Stars Strikers, Rising Stars Chargers, Rising Stars Mavericks"
  },
  {
    "academy": "SparC",
    "teams": "SparC Rising Stars"
  },
  {
    "academy": "Sparta Cricket",
    "teams": "Sparta Cricket Club"
  },
  {
    "academy": "StarSports US",
    "teams": "StarSportsUS Knights, StarSportsUS Rising Stars, StarSportsUS Warriors, StarSportsUS Crushers, StarSportsUS Flyers, StarSports US Knights, StarSportsUS Lions, StarSportsUS Crushers, StarSportsUS Gladiators (TBD),StarSports US New Team"
  },
  {
    "academy": "Staten Island",
    "teams": "Staten Island"
  },
  {
    "academy": "Stelton Sports",
    "teams": "Stelton Acers, Stelton Avengers"
  },
  {
    "academy": "SuperKings Academy NJ",
    "teams": "SKA Cubs, SKA Prides, SKA Roar, SKA Lions, SKA Kings"
  }
]
// ----------------------------------------------------------------
// Predefined filters — extend this list freely
// ----------------------------------------------------------------
const PREDEFINED_FILTERS: PredefinedFilter[] = [
  // Examples — customize to match your actual sheet columns:
  { id: 'Week1', label: 'Apr 18/19', category: 'Week', column: 'Date', value: '04/18/2026,04/19/2026', color: 'green' },
  { id: 'Week2', label: 'Apr 25/26', category: 'Week', column: 'Date', value: '04/25/2026,04/26/2026', color: 'green' },
  { id: 'Week3', label: 'May 2/3', category: 'Week', column: 'Date', value: '05/02/2026,05/03/2026', color: 'green' },
  { id: 'Week4', label: 'May 9/10', category: 'Week', column: 'Date', value: '05/09/2026,05/10/2026', color: 'green' },
  { id: 'Week5', label: 'May 16/17', category: 'Week', column: 'Date', value: '05/16/2026,05/17/2026', color: 'green' },
  { id: 'Week6', label: 'May 30/31', category: 'Week', column: 'Date', value: '05/30/2026,05/31/2026', color: 'green' },
  { id: 'Week7', label: 'Jun 6/7', category: 'Week', column: 'Date', value: '06/06/2026,06/07/2026', color: 'green' },
  { id: 'u11', label: 'U11', category: 'Age category', column: 'Cat', value: 'U11A,U11B', color: 'red' },
  { id: 'u13', label: 'U13', category: 'Age category', column: 'Cat', value: 'U13A,U13B', color: 'red' },
  { id: 'u15', label: 'U15', category: 'Age category', column: 'Cat', value: 'U15A,U15B', color: 'red' },
  { id: 'u17', label: 'U17', category: 'Age category', column: 'Cat', value: 'U17', color: 'red' },
  ...ACADEMY_TEAMS.map((entry) => ({
    id: entry.academy
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, ''),
    label: entry.academy,
    category: 'Academy',
    column: ['Home Team', 'Away Team'],
    value: entry.teams,
    color: 'blue',
  })),
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
    predefined: [],
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

  // ── Load saved predefined filters from localStorage ──────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem('selectedPredefinedFilters');
      if (saved) {
        const savedIds: string[] = JSON.parse(saved);
        // Filter out IDs that no longer exist in PREDEFINED_FILTERS
        const validIds = savedIds.filter(id => PREDEFINED_FILTERS.some(pf => pf.id === id));
        if (validIds.length > 0) {
          setFilters(prev => ({ ...prev, predefined: validIds }));
        }
      }
    } catch (error) {
      console.warn('Failed to load saved filters from localStorage:', error);
    }
  }, []);

  // ── Save predefined filters to localStorage when they change ──
  useEffect(() => {
    try {
      localStorage.setItem('selectedPredefinedFilters', JSON.stringify(filters.predefined));
    } catch (error) {
      console.warn('Failed to save filters to localStorage:', error);
    }
  }, [filters.predefined]);

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

    // Column filters: support manual column filters and predefined filter groups
    const activeColumnFilters = Object.entries(filters).filter(
      ([key, value]) =>
        key !== 'search' && key !== 'column' && key !== 'predefined' && value
    ) as [string, string | string[]][];
    activeColumnFilters.forEach(([column, value]) => {
      rows = rows.filter((row) => {
        const cellValue = String(row[column] || '').trim().toLowerCase();
        return Array.isArray(value)
          ? value.some((item) => cellValue === item.trim().toLowerCase())
          : cellValue === String(value).trim().toLowerCase();
      });
    });

    const selectedPredefinedFilters = PREDEFINED_FILTERS.filter((pf) =>
      filters.predefined.includes(pf.id)
    );

    if (selectedPredefinedFilters.length > 0) {
      const groupedPredefined = new Map<string, { columns: string[]; values: string[] }>();

      selectedPredefinedFilters.forEach((pf) => {
        const columns = Array.isArray(pf.column)
          ? pf.column
          : pf.column.split(',').map((col) => col.trim()).filter(Boolean);
        const values = Array.isArray(pf.value)
          ? pf.value
          : pf.value.split(',').map((value) => value.trim()).filter(Boolean);
        const key = columns.join('|');

        const current = groupedPredefined.get(key) ?? { columns, values: [] };
        values.forEach((value) => {
          if (!current.values.includes(value)) {
            current.values.push(value);
          }
        });
        groupedPredefined.set(key, current);
      });

      rows = rows.filter((row) => {
        return Array.from(groupedPredefined.values()).every(({ columns, values }) => {
          return columns.some((column) => {
            const cellValue = String(row[column] || '').trim().toLowerCase();
            return values.some((value) => cellValue === value.toLowerCase());
          });
        });
      });
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

    const activeColumnFilters = Object.entries(filters).filter(
      ([key, value]) =>
        key !== 'search' && key !== 'column' && key !== 'predefined' && value
    ) as [string, string | string[]][];

    activeColumnFilters.forEach(([column, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          params.append('filterColumn', column);
          params.append('filterValue', item);
        });
      } else {
        params.append('filterColumn', column);
        params.append('filterValue', value);
      }
    });

    if (sortState.column) {
      params.set('sortColumn', sortState.column);
      params.set('sortDirection', sortState.direction || 'asc');
    }
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
            headers={sheetData.headers.filter((header) => header !== 'Season')}
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
                headers={sheetData.headers.filter((header) => header !== 'Season')}
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
            <span>Last refreshed: {new Date(sheetData.lastFetched).toLocaleString()}</span>
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
