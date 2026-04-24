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

  const allSelected = rows.length > 0 && rows.every((r) => selectedRows.has(r.__rowIndex));
  const someSelected = rows.some((r) => selectedRows.has(r.__rowIndex));

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
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth: `${headers.length * 140}px` }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {/* Checkbox column */}
            {isEditor && (
              <th className="w-10 px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="rounded"
                  style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
              </th>
            )}
            {/* Row number */}
            <th className="w-12 px-3 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              #
            </th>
            {headers.map((header) => (
              <th
                key={header}
                className="px-4 py-3 text-left font-medium cursor-pointer select-none group whitespace-nowrap"
                style={{ color: 'var(--text-secondary)' }}
                onClick={() => onSort(header)}
              >
                <div className="flex items-center gap-1.5">
                  {editableColumns.includes(header) && (
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: 'var(--editable)' }}
                      title="Editable column"
                    />
                  )}
                  <span>{header}</span>
                  <SortIcon
                    direction={sortState.column === header ? sortState.direction : null}
                  />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => {
            const isSelected = selectedRows.has(row.__rowIndex);
            const displayRowNum = (page - 1) * pageSize + rowIdx + 1;

            return (
              <tr
                key={row.__rowIndex}
                className={`data-row transition-colors ${isSelected ? 'selected' : ''}`}
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                {/* Checkbox */}
                {isEditor && (
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => onSelectRow(row.__rowIndex, e.target.checked)}
                      style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                  </td>
                )}
                {/* Row number */}
                <td className="px-3 py-2.5 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                  {displayRowNum}
                </td>
                {/* Data cells */}
                {headers.map((header) => {
                  const isEditable = isEditor && editableColumns.includes(header);
                  const isEditing = editingCell?.rowIndex === row.__rowIndex && editingCell?.column === header;
                  const hasPending = isPendingEdit(row, header);
                  const cellValue = getCellValue(row, header);

                  return (
                    <td
                      key={header}
                      className={`px-4 py-2.5 ${isEditable ? 'editable-cell' : ''}`}
                      style={{
                        background: hasPending ? 'rgba(59,130,246,0.08)' : undefined,
                        cursor: isEditable ? 'text' : 'default',
                        maxWidth: '260px',
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
                          className="cell-input"
                        />
                      ) : (
                        <span
                          className="block truncate text-sm"
                          style={{
                            color: hasPending ? 'var(--accent-bright)' : 'var(--text-primary)',
                          }}
                        >
                          {cellValue || (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>
                          )}
                        </span>
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
