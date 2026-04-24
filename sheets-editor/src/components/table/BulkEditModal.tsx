'use client';

import React, { useState } from 'react';

interface BulkEditModalProps {
  selectedCount: number;
  editableColumns: string[];
  onApply: (column: string, value: string) => void;
  onClose: () => void;
}

export function BulkEditModal({
  selectedCount,
  editableColumns,
  onApply,
  onClose,
}: BulkEditModalProps) {
  const [column, setColumn] = useState(editableColumns[0] || '');
  const [value, setValue] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const handleApply = () => {
    if (!column || !confirmed) return;
    onApply(column, value);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl animate-slide-in"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              Bulk Edit
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Apply changes to{' '}
              <span style={{ color: 'var(--accent-bright)' }}>{selectedCount} selected row{selectedCount !== 1 ? 's' : ''}</span>
            </p>
          </div>
          <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity" style={{ color: 'var(--text-secondary)' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="3" x2="13" y2="13" />
              <line x1="13" y1="3" x2="3" y2="13" />
            </svg>
          </button>
        </div>

        {/* Column selector */}
        <div className="mb-4">
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Column to update
          </label>
          <select
            value={column}
            onChange={(e) => setColumn(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            {editableColumns.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Value input */}
        <div className="mb-5">
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            New value
          </label>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`Set "${column}" to…`}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </div>

        {/* Warning */}
        <div
          className="flex items-start gap-2.5 p-3 rounded-lg mb-5 text-xs"
          style={{ background: 'var(--warning-dim)', border: '1px solid var(--warning)', color: 'var(--warning)' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
            <path d="M7 1.5L13 12H1L7 1.5z" />
            <line x1="7" y1="6" x2="7" y2="9" />
            <circle cx="7" cy="10.5" r="0.5" fill="currentColor" />
          </svg>
          <span>
            This will overwrite the <strong>"{column}"</strong> field for {selectedCount} row{selectedCount !== 1 ? 's' : ''}.
            Each change will be logged individually.
          </span>
        </div>

        {/* Confirmation checkbox */}
        <label className="flex items-center gap-2.5 mb-5 cursor-pointer text-sm" style={{ color: 'var(--text-secondary)' }}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            style={{ accentColor: 'var(--accent)', width: '14px', height: '14px' }}
          />
          I understand this will update {selectedCount} row{selectedCount !== 1 ? 's' : ''}
        </label>

        {/* Actions */}
        <div className="flex gap-2.5 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm transition-colors hover:opacity-80"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!confirmed || !column}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
            }}
          >
            Apply to {selectedCount} row{selectedCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
