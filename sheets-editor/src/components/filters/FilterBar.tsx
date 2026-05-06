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
    if (nextPredefined.has(pf.id)) {
      nextPredefined.delete(pf.id);
    } else {
      nextPredefined.add(pf.id);
    }

    onFiltersChange({
      ...filters,
      predefined: Array.from(nextPredefined),
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
      className="p-6 rounded-2xl space-y-4 transition-all duration-300 hover:shadow-lg"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
      }}
    >
      {/* Enhanced Search + column filter row */}
      <div className="flex flex-wrap gap-4">
        {/* Enhanced Search input */}
        <div className="flex-1 min-w-56 relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-200" style={{ color: filters.search ? 'var(--accent)' : 'var(--text-muted)' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="7" cy="7" r="4" />
              <line x1="12" y1="12" x2="9" y2="9" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search across all data…"
            value={filters.search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl text-sm transition-all duration-200 focus:ring-2"
            style={{
              background: 'var(--bg-base)',
              border: `2px solid ${filters.search ? 'var(--accent)' : 'var(--border)'}`,
              color: 'var(--text-primary)',
              outline: 'none'
            }}
          />
        </div>

        {/* Enhanced Column selector */}
        <div className="relative">
          <select
            value={filters.column || ''}
            onChange={(e) => handleColumnFilter(e.target.value)}
            className="px-4 py-3 pr-8 rounded-xl text-sm appearance-none transition-all duration-200 focus:ring-2"
            style={{
              background: 'var(--bg-base)',
              border: `2px solid ${filters.column ? 'var(--accent)' : 'var(--border)'}`,
              color: filters.column ? 'var(--text-primary)' : 'var(--text-muted)',
              minWidth: '180px',
              outline: 'none'
            }}
          >
            <option value="">Filter by column…</option>
            {headers.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3,5 6,8 9,5" />
            </svg>
          </div>
        </div>

        {/* Enhanced Column filter value */}
        <div className="flex-1 min-w-[240px] relative">
          <input
            type="text"
            placeholder={filters.column ? `Filter ${filters.column}…` : 'Select a column first…'}
            value={filters.column ? formatFilterValue(filters[filters.column] || '') : ''}
            onChange={(e) => handleColumnValueChange(filters.column, e.target.value)}
            disabled={!filters.column}
            className="w-full pr-4 py-3 rounded-xl text-sm transition-all duration-200 focus:ring-2 disabled:opacity-50"
            style={{
              background: 'var(--bg-base)',
              border: `2px solid ${filters.column ? 'var(--accent)' : 'var(--border)'}`,
              color: filters.column ? 'var(--text-primary)' : 'var(--text-muted)',
              outline: 'none'
            }}
          />
        </div>

        {/* Enhanced Clear button */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-4 py-3 rounded-xl text-sm flex items-center gap-2 transition-all duration-200 hover:scale-105 hover:shadow-md"
            style={{
              background: 'linear-gradient(135deg, #fee2e2, #fecaca)',
              border: '1px solid #fca5a5',
              color: '#dc2626'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 2.5l9 9M11.5 2.5l-9 9" />
            </svg>
            Clear All
          </button>
        )}

        {/* Enhanced Row count */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ml-auto transition-all duration-200"
             style={{
               background: 'var(--bg-elevated)',
               border: '1px solid var(--border)',
               color: 'var(--text-secondary)'
             }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 2h10v10H2zM6 6l4 4M10 6l-4 4" />
          </svg>
          {filteredRows === totalRows ? (
            <span>{totalRows} rows</span>
          ) : (
            <span>
              <span style={{ color: 'var(--accent)' }}>{filteredRows}</span> of {totalRows} rows
            </span>
          )}
        </div>
      </div>

      {/* Enhanced Active column filters */}
      {activeColumnFilters.length > 0 && (
        <div className="flex flex-wrap gap-3 p-3 rounded-xl animate-fade-in" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3,1 9,1 9,7 3,7" />
              <line x1="1" y1="3" x2="3" y2="3" />
              <line x1="1" y1="5" x2="3" y2="5" />
            </svg>
            Column Filters:
          </div>
          {activeColumnFilters.map(([column, value]) => (
            <button
              key={column}
              onClick={() => removeColumnFilter(column)}
              className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 hover:scale-105 flex items-center gap-1.5"
              style={{
                background: 'var(--bg-base)',
                borderColor: 'var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              <span className="font-semibold" style={{ color: 'var(--accent)' }}>{column}:</span>
              {Array.isArray(value) ? value.join(' or ') : value}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="9" y2="9" />
                <line x1="9" y1="1" x2="1" y2="9" />
              </svg>
            </button>
          ))}
        </div>
      )}

      {/* Enhanced Predefined filter chips */}
      {predefinedFilters.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3,1 13,1 13,11 3,11" />
              <line x1="1" y1="5" x2="3" y2="5" />
              <line x1="1" y1="9" x2="3" y2="9" />
              <circle cx="7" cy="7" r="1" fill="currentColor" />
            </svg>
            Quick Filters
          </div>
          {Object.entries(
            predefinedFilters.reduce((result, pf) => {
              const category = pf.category || 'Other';
              if (!result[category]) result[category] = [];
              result[category].push(pf);
              return result;
            }, {} as Record<string, PredefinedFilter[]>)
          ).map(([category, categoryFilters]) => {
            const getCategoryIcon = (cat: string) => {
              switch (cat.toLowerCase()) {
                case 'week': return '📅';
                case 'age category': return '👶';
                case 'academy': return '🏆';
                default: return '🏷️';
              }
            };

            return (
              <div key={category} className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  <span className="text-base">{getCategoryIcon(category)}</span>
                  {category}
                </div>
                <div className="flex flex-wrap gap-2">
                  {categoryFilters.map((pf) => {
                    const isSelected = filters.predefined.includes(pf.id);
                    return (
                      <button
                        key={pf.id}
                        onClick={() => handlePredefinedFilter(pf.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 hover:scale-105 flex items-center gap-2 ${
                          isSelected ? 'ring-2 shadow-lg' : 'hover:shadow-md'
                        }`}
                        style={{
                          background: isSelected
                            ? `linear-gradient(135deg, ${pf.color === 'blue' ? 'var(--accent-dim)' : 'var(--success-dim)'}, ${pf.color === 'blue' ? 'var(--accent)' : 'var(--success)'})`
                            : 'var(--bg-elevated)',
                          borderColor: isSelected ? (pf.color === 'blue' ? 'var(--accent)' : 'var(--success)') : 'var(--border)',
                          color: isSelected ? 'white' : 'var(--text-secondary)',
                          boxShadow: isSelected ? `0 4px 12px rgba(${pf.color === 'blue' ? '246,181,8' : '34,197,94'}, 0.3)` : 'none'
                        }}
                      >
                        {isSelected && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="2,6 5,9 10,3" />
                          </svg>
                        )}
                        {pf.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
