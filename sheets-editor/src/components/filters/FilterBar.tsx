'use client';

import React from 'react';
import type { FilterState, PredefinedFilter, SortState } from '@/types';

interface FilterBarProps {
  headers: string[];
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  predefinedFilters: PredefinedFilter[];
  totalRows: number;
  filteredRows: number;
}

export function FilterBar({
  headers,
  filters,
  onFiltersChange,
  predefinedFilters,
  totalRows,
  filteredRows,
}: FilterBarProps) {
  const handleSearch = (value: string) => {
    onFiltersChange({ ...filters, search: value });
  };

  const handleColumnFilter = (column: string) => {
    onFiltersChange({ ...filters, column: column || null, predefined: null });
  };

  const handlePredefinedFilter = (filterId: string) => {
    const pf = predefinedFilters.find((f) => f.id === filterId);
    if (!pf) {
      onFiltersChange({ ...filters, predefined: null, column: null });
      return;
    }
    onFiltersChange({
      ...filters,
      predefined: filterId,
      column: pf.column,
      [pf.column]: pf.value,
    });
  };

  const clearFilters = () => {
    onFiltersChange({ search: '', column: null, predefined: null });
  };

  const hasActiveFilters = filters.search || filters.column || filters.predefined;

  return (
    <div
      className="p-4 rounded-xl space-y-3"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      {/* Search + column filter row */}
      <div className="flex flex-wrap gap-3">
        {/* Search input */}
        <div className="flex-1 min-w-48 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <SearchIcon />
          </div>
          <input
            type="text"
            placeholder="Search all columns…"
            value={filters.search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm transition-all"
            style={{
              background: 'var(--bg-base)',
              border: `1px solid ${filters.search ? 'var(--accent)' : 'var(--border)'}`,
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </div>

        {/* Column selector */}
        <select
          value={filters.column || ''}
          onChange={(e) => handleColumnFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm"
          style={{
            background: 'var(--bg-base)',
            border: `1px solid ${filters.column ? 'var(--accent)' : 'var(--border)'}`,
            color: filters.column ? 'var(--text-primary)' : 'var(--text-muted)',
            minWidth: '150px',
          }}
        >
          <option value="">Filter by column…</option>
          {headers.map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>

        {/* Clear button */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-2 rounded-lg text-sm flex items-center gap-1.5 transition-colors hover:opacity-80"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            <ClearIcon />
            Clear
          </button>
        )}

        {/* Row count */}
        <div className="flex items-center text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
          {filteredRows === totalRows ? (
            <span>{totalRows} rows</span>
          ) : (
            <span>
              <span style={{ color: 'var(--accent-bright)' }}>{filteredRows}</span> of {totalRows} rows
            </span>
          )}
        </div>
      </div>

      {/* Predefined filter chips */}
      {predefinedFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs self-center" style={{ color: 'var(--text-muted)' }}>Quick filters:</span>
          {predefinedFilters.map((pf) => (
            <button
              key={pf.id}
              onClick={() =>
                filters.predefined === pf.id
                  ? handlePredefinedFilter('')
                  : handlePredefinedFilter(pf.id)
              }
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                filters.predefined === pf.id ? 'filter-chip-active' : ''
              }`}
              style={{
                background: filters.predefined === pf.id ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                borderColor: filters.predefined === pf.id ? 'var(--accent)' : 'var(--border)',
                color: filters.predefined === pf.id ? 'var(--accent-bright)' : 'var(--text-secondary)',
              }}
            >
              {pf.label}
            </button>
          ))}
          {/* Placeholder — add more filters here */}
          <button
            className="px-3 py-1 rounded-full text-xs border border-dashed opacity-40 hover:opacity-60 transition-opacity"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            title="Add custom filter"
          >
            + Add filter
          </button>
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)' }}>
      <circle cx="6" cy="6" r="4" />
      <line x1="9.5" y1="9.5" x2="12" y2="12" strokeLinecap="round" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="2" y1="2" x2="10" y2="10" />
      <line x1="10" y1="2" x2="2" y2="10" />
    </svg>
  );
}
