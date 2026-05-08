'use client';

import React from 'react';
import type { SheetRow, CellEdit } from '@/types';

interface RowDetailsModalProps {
  isOpen: boolean;
  row: SheetRow | null;
  headers: string[];
  editableColumns: string[];
  isEditor: boolean;
  pendingEdits: Map<string, CellEdit>;
  onCellEdit: (edit: CellEdit) => void;
  onClose: () => void;
}

export function RowDetailsModal({
  isOpen,
  row,
  headers,
  editableColumns,
  isEditor,
  pendingEdits,
  onCellEdit,
  onClose,
}: RowDetailsModalProps) {
  const [editingField, setEditingField] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState('');

  const getCellValue = (column: string): string => {
    if (!row) return '';
    const key = `${row.__rowIndex}:${column}`;
    const pending = pendingEdits.get(key);
    return pending ? pending.newValue : String(row[column] ?? '');
  };

  const isPendingEdit = (column: string): boolean => {
    if (!row) return false;
    return pendingEdits.has(`${row.__rowIndex}:${column}`);
  };

  const handleStartEdit = (column: string) => {
    if (!isEditor || !editableColumns.includes(column)) return;
    setEditValue(getCellValue(column));
    setEditingField(column);
  };

  const handleSaveEdit = (column: string) => {
    if (!row) return;
    const originalValue = String(row[column] ?? '');
    if (editValue !== originalValue || pendingEdits.has(`${row.__rowIndex}:${column}`)) {
      onCellEdit({
        rowIndex: row.__rowIndex,
        column,
        oldValue: originalValue,
        newValue: editValue,
      });
    }
    setEditingField(null);
  };

  const handleCancel = () => {
    setEditingField(null);
    setEditValue('');
  };

  if (!isOpen || !row) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        style={{ opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none' }}
      />

      {/* Modal */}
      <div
        className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:w-full md:max-w-2xl md:-translate-x-1/2 md:-translate-y-1/2 z-50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] md:max-h-[80vh]"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 md:px-6 py-4 md:py-5 border-b"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}
        >
          <h2 className="text-lg md:text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            Row Details
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-all hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.05)' }}
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="5" x2="15" y2="15" />
              <line x1="15" y1="5" x2="5" y2="15" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {headers.map((header) => {
            const isEditable = isEditor && editableColumns.includes(header);
            const isEditing = editingField === header;
            const hasPending = isPendingEdit(header);
            const value = getCellValue(header);

            return (
              <div
                key={header}
                className="rounded-lg p-4 transition-all"
                style={{
                  background: hasPending ? 'rgba(59,130,246,0.08)' : 'var(--bg-base)',
                  border: `1px solid ${hasPending ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`,
                }}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    {header}
                  </label>
                  {hasPending && (
                    <span
                      className="text-xs px-2 py-1 rounded-full"
                      style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--accent-bright)' }}
                    >
                      Pending
                    </span>
                  )}
                </div>

                {isEditing ? (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border-2 transition-all text-sm"
                      style={{
                        background: 'var(--bg-surface)',
                        borderColor: 'var(--accent)',
                        color: 'var(--text-primary)',
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveEdit(header);
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          handleCancel();
                        }
                      }}
                    />
                    <button
                      onClick={() => handleSaveEdit(header)}
                      className="px-3 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
                      style={{ background: 'var(--accent)', color: 'white' }}
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancel}
                      className="px-3 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
                      style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div
                    className={`text-sm leading-relaxed break-words cursor-pointer py-2 px-2 rounded transition-all ${
                      isEditable ? 'hover:bg-opacity-50' : ''
                    }`}
                    onClick={() => handleStartEdit(header)}
                    style={{
                      color: value ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontWeight: hasPending ? '600' : '400',
                      fontStyle: !value ? 'italic' : 'normal',
                      opacity: !value ? 0.6 : 1,
                    }}
                    title={isEditable ? 'Click to edit' : undefined}
                  >
                    {value || '—'}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          className="border-t px-4 md:px-6 py-3 flex justify-end gap-2"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-base)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
