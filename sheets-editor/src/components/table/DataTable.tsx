'use client';

import React, { useState, useCallback } from 'react';
import type { SheetRow, SortState, CellEdit } from '@/types';

interface DataTableProps {
  headers: string[];
  rows: SheetRow[];
  editableColumns: string[];
  isEditor: boolean;
  selectedRows: Set<number>;
  onSelectRow: (rowIndex: number, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  sortState: SortState;
  onSort: (column: string) => void;
  pendingEdits: Map<string, CellEdit>;
  onCellEdit: (edit: CellEdit) => void;
  page: number;
  pageSize: number;
}

export function DataTable({
  headers,
  rows,
  editableColumns,
  isEditor,
  selectedRows,
  onSelectRow,
  onSelectAll,
  sortState,
  onSort,
  pendingEdits,
  onCellEdit,
  page,
  pageSize,
}: DataTableProps) {
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; column: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const allSelected = rows.length > 0 && rows.every((r) => selectedRows.has(r.__rowIndex));
  const someSelected = rows.some((r) => selectedRows.has(r.__rowIndex));

  // Swipe gesture handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    // For now, we'll just log the swipe direction
    // In a full implementation, this could trigger pagination or column scrolling
    if (isLeftSwipe) {
      console.log('Swiped left - could scroll right or go to next page');
    }
    if (isRightSwipe) {
      console.log('Swiped right - could scroll left or go to previous page');
    }
  }, [touchStart, touchEnd]);

  const startEdit = useCallback((row: SheetRow, column: string) => {
    if (!isEditor || !editableColumns.includes(column)) return;
    const key = `${row.__rowIndex}:${column}`;
    const pending = pendingEdits.get(key);
    setEditValue(pending ? pending.newValue : String(row[column] ?? ''));
    setEditingCell({ rowIndex: row.__rowIndex, column });
  }, [isEditor, editableColumns, pendingEdits]);

  const commitEdit = useCallback((row: SheetRow, column: string) => {
    const originalValue = String(row[column] ?? '');
    if (editValue !== originalValue || pendingEdits.has(`${row.__rowIndex}:${column}`)) {
      onCellEdit({
        rowIndex: row.__rowIndex,
        column,
        oldValue: originalValue,
        newValue: editValue,
      });
    }
    setEditingCell(null);
  }, [editValue, onCellEdit, pendingEdits]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, row: SheetRow, column: string) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(row, column); }
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
    if (e.key === 'Tab') { commitEdit(row, column); }
  }, [commitEdit, cancelEdit]);

  const getCellValue = (row: SheetRow, column: string): string => {
    const key = `${row.__rowIndex}:${column}`;
    const pending = pendingEdits.get(key);
    return pending ? pending.newValue : String(row[column] ?? '');
  };

  const isPendingEdit = (row: SheetRow, column: string): boolean => {
    return pendingEdits.has(`${row.__rowIndex}:${column}`);
  };

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center" style={{ color: 'var(--text-muted)' }}>
        <EmptyIcon />
        <p className="mt-3 text-sm">No rows match your filters</p>
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto rounded-xl shadow-sm"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <table className="w-full border-collapse text-sm" style={{ minWidth: `${Math.max(headers.length * 140, 600)}px` }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-elevated)' }}>
            {/* Checkbox column - Mobile optimized */}
            {isEditor && (
              <th className="w-12 px-3 sm:px-4 py-3 sm:py-4 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="w-5 h-5 rounded border-2 transition-all duration-200 hover:scale-110 touch-manipulation"
                  style={{
                    accentColor: 'var(--accent)',
                    cursor: 'pointer',
                    borderColor: 'var(--border)',
                    background: 'var(--bg-base)'
                  }}
                />
              </th>
            )}
            {headers.map((header) => (
              <th
                key={header}
                className="px-3 sm:px-4 py-3 sm:py-4 text-left font-semibold cursor-pointer select-none group whitespace-nowrap transition-all duration-200 hover:bg-gray-50 touch-manipulation"
                style={{ color: 'var(--text-primary)', borderRight: '1px solid var(--border)' }}
                onClick={() => onSort(header)}
              >
                <div className="flex items-center gap-2">
                  {editableColumns.includes(header) && (
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0 transition-all duration-200 group-hover:scale-125"
                      style={{ background: 'var(--editable)', boxShadow: '0 0 6px rgba(59,130,246,0.4)' }}
                      title="Editable column"
                    />
                  )}
                  <span className="text-xs font-bold uppercase tracking-wider">{header}</span>
                  <div className="transition-transform duration-200 group-hover:scale-110">
                    <SortIcon
                      direction={sortState.column === header ? sortState.direction : null}
                    />
                  </div>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => {
            const isSelected = selectedRows.has(row.__rowIndex);
            const isEvenRow = rowIdx % 2 === 0;

            return (
              <tr
                key={row.__rowIndex}
                className={`data-row transition-all duration-200 hover:shadow-md ${
                  isSelected ? 'selected' : ''
                } ${isEvenRow ? 'even-row' : 'odd-row'}`}
                style={{
                  borderBottom: '1px solid var(--border)',
                  background: isSelected
                    ? 'linear-gradient(135deg, rgba(246,181,8,0.1), rgba(246,181,8,0.05))'
                    : isEvenRow
                      ? 'var(--bg-base)'
                      : 'var(--bg-elevated)',
                }}
              >
                {/* Checkbox - Mobile optimized */}
                {isEditor && (
                  <td className="px-3 sm:px-4 py-2 sm:py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => onSelectRow(row.__rowIndex, e.target.checked)}
                      className="w-5 h-5 rounded border-2 transition-all duration-200 hover:scale-110 touch-manipulation"
                      style={{
                        accentColor: 'var(--accent)',
                        cursor: 'pointer',
                        borderColor: 'var(--border)',
                        background: 'var(--bg-surface)'
                      }}
                    />
                  </td>
                )}
                {/* Data cells - Mobile optimized */}
                {headers.map((header) => {
                  const isEditable = isEditor && editableColumns.includes(header);
                  const isEditing = editingCell?.rowIndex === row.__rowIndex && editingCell?.column === header;
                  const hasPending = isPendingEdit(row, header);
                  const cellValue = getCellValue(row, header);

                  return (
                    <td
                      key={header}
                      className={`px-3 sm:px-4 py-2 sm:py-3 transition-all duration-200 hover:bg-opacity-50 ${
                        isEditable ? 'editable-cell' : ''
                      }`}
                      style={{
                        background: hasPending
                          ? 'rgba(59,130,246,0.08)'
                          : 'transparent',
                        cursor: isEditable ? 'text' : 'default',
                        maxWidth: '200px',
                        borderRight: '1px solid var(--border)',
                        position: 'relative'
                      }}
                      onDoubleClick={() => startEdit(row, header)}
                      title={isEditable && !isEditing ? 'Double-click to edit' : undefined}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => commitEdit(row, header)}
                          onKeyDown={(e) => handleKeyDown(e, row, header)}
                          className="cell-input w-full px-2 py-1 h-9 rounded border-2 transition-all duration-200 focus:ring-2 touch-manipulation"
                          style={{
                            background: 'var(--bg-surface)',
                            borderColor: 'var(--accent)',
                            color: 'var(--text-primary)',
                            outline: 'none'
                          }}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <span
                            className="block truncate text-sm leading-relaxed"
                            style={{
                              color: hasPending
                                ? 'var(--accent-bright)'
                                : cellValue
                                  ? 'var(--text-primary)'
                                  : 'var(--text-muted)',
                              fontWeight: hasPending ? '600' : '400'
                            }}
                          >
                            {cellValue || (
                              <span className="italic opacity-60">—</span>
                            )}
                          </span>
                          {hasPending && (
                            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SortIcon({ direction }: { direction: 'asc' | 'desc' | null }) {
  if (!direction) {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-0 group-hover:opacity-30 transition-opacity" style={{ color: 'var(--text-muted)' }}>
        <line x1="5" y1="2" x2="5" y2="8" strokeLinecap="round" />
        <line x1="2" y1="4.5" x2="5" y2="2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="8" y1="4.5" x2="5" y2="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: 'var(--accent-bright)' }}>
      {direction === 'asc' ? (
        <>
          <line x1="5" y1="8" x2="5" y2="2" strokeLinecap="round" />
          <line x1="2" y1="4.5" x2="5" y2="2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="8" y1="4.5" x2="5" y2="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <line x1="5" y1="2" x2="5" y2="8" strokeLinecap="round" />
          <line x1="2" y1="5.5" x2="5" y2="8" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="8" y1="5.5" x2="5" y2="8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

function EmptyIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
      <rect x="8" y="8" width="32" height="32" rx="4" />
      <line x1="8" y1="18" x2="40" y2="18" />
      <line x1="8" y1="28" x2="40" y2="28" />
      <line x1="18" y1="18" x2="18" y2="40" />
    </svg>
  );
}
