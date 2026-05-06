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
  const normalizeFilterValue = (value: string | string[] | null): string | string[] | null => {
    if (!value) return null;
    if (Array.isArray(value)) {
      const normalized = value.map((item) => item.trim()).filter(Boolean);
      return normalized.length === 0 ? null : normalized.length === 1 ? normalized[0] : normalized;
    }

    const parts = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    return parts.length === 0 ? null : parts.length === 1 ? parts[0] : parts;
  };

  const formatFilterValue = (value: string | string[] | null) => {
    if (!value) return '';
    return Array.isArray(value) ? value.join(', ') : value;
  };

  const handleSearch = (value: string) => {
    onFiltersChange({ ...filters, search: value });
  };

  const handleColumnFilter = (column: string) => {
    onFiltersChange({ ...filters, column: column || null });
  };

  const handleColumnValueChange = (column: string | null, value: string) => {
    if (!column) return;
    onFiltersChange({ ...filters, [column]: normalizeFilterValue(value), column });
  };

  const handlePredefinedFilter = (filterId: string) => {
    const pf = predefinedFilters.find((f) => f.id === filterId);
    if (!pf) {
      return;
    }

    const nextPredefined = new Set(filters.predefined || []);
    const existingValues = filters[pf.column];
    const currentValues = Array.isArray(existingValues)
      ? [...existingValues]
      : existingValues
      ? [existingValues]
      : [];

    const nextValues = new Set(currentValues);

    if (nextPredefined.has(pf.id)) {
      nextPredefined.delete(pf.id);
      nextValues.delete(pf.value);
    } else {
      nextPredefined.add(pf.id);
      nextValues.add(pf.value);
    }

    const nextFilterValue = normalizeFilterValue(Array.from(nextValues).join(', '));

    onFiltersChange({
      ...filters,
      predefined: Array.from(nextPredefined),
      column: pf.column,
      [pf.column]: nextFilterValue,
    });
  };

  const removeColumnFilter = (column: string) => {
    const nextFilters = { ...filters };
    delete nextFilters[column];
    if (nextFilters.column === column) {
      nextFilters.column = null;
    }
    onFiltersChange(nextFilters as FilterState);
  };

  const clearFilters = () => {
    onFiltersChange({ search: '', column: null, predefined: [] });
  };

  const activeColumnFilters = Object.entries(filters).filter(
    ([key, value]) =>
      key !== 'search' && key !== 'column' && key !== 'predefined' && value
  ) as [string, string | string[]][];

  const hasActiveFilters =
    Boolean(filters.search) || filters.predefined.length > 0 || activeColumnFilters.length > 0;

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

        {/* Column filter value */}
        <div className="flex-1 min-w-[220px] relative">
          <input
            type="text"
            placeholder={filters.column ? `Filter ${filters.column}…` : 'Select a column first…'}
            value={filters.column ? formatFilterValue(filters[filters.column] || '') : ''}
            onChange={(e) => handleColumnValueChange(filters.column, e.target.value)}
            disabled={!filters.column}
            className="w-full pr-3 py-2 rounded-lg text-sm transition-all"
            style={{
              background: 'var(--bg-base)',
              border: `1px solid ${filters.column ? 'var(--accent)' : 'var(--border)'}`,
              color: filters.column ? 'var(--text-primary)' : 'var(--text-muted)',
              outline: 'none',
            }}
          />
        </div>

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

      {activeColumnFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeColumnFilters.map(([column, value]) => (
            <button
              key={column}
              onClick={() => removeColumnFilter(column)}
              className="px-3 py-1 rounded-full text-xs font-medium border transition-all"
              style={{
                background: 'var(--bg-elevated)',
                borderColor: 'var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              {column}: {Array.isArray(value) ? value.join(' or ') : value}
              <span className="ml-2" aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}

      {/* Predefined filter chips */}
      {predefinedFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs self-center" style={{ color: 'var(--text-muted)' }}>Quick filters:</span>
          {predefinedFilters.map((pf) => {
            const isSelected = filters.predefined.includes(pf.id);
            return (
              <button
                key={pf.id}
                onClick={() => handlePredefinedFilter(pf.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  isSelected ? 'filter-chip-active' : ''
                }`}
                style={{
                  background: isSelected ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                  borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                  color: isSelected ? 'var(--accent-bright)' : 'var(--text-secondary)',
                }}
              >
                {pf.label}
              </button>
            );
          })}
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
