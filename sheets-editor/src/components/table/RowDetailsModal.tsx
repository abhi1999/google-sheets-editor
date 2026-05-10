'use client';

import React from 'react';
import type { SheetRow, CellEdit } from '@/types';

interface RowDetailsModalProps {
  isOpen: boolean;
  row: SheetRow | null;
  headers: string[];
  pendingEdits: Map<string, CellEdit>;
  onClose: () => void;
}

export function RowDetailsModal({ isOpen, row, headers, pendingEdits, onClose }: RowDetailsModalProps) {
  if (!isOpen || !row) return null;

  const getValue = (col: string) => {
    const pending = pendingEdits.get(`${row.__rowIndex}:${col}`);
    return pending ? pending.newValue : String(row[col] ?? '');
  };

  const isPending = (col: string) => pendingEdits.has(`${row.__rowIndex}:${col}`);

  const nonEmpty = headers.filter((h) => getValue(h) !== '');
  const empty = headers.filter((h) => getValue(h) === '');

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 z-50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] md:max-h-[80vh]"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Row Details
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-all hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <tbody>
              {nonEmpty.map((header, i) => (
                <tr
                  key={header}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: i % 2 === 0 ? 'var(--bg-base)' : 'var(--bg-elevated)',
                  }}
                >
                  <td
                    className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap align-top w-36"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {header}
                  </td>
                  <td className="px-4 py-2.5 break-words" style={{ color: 'var(--text-primary)' }}>
                    <span style={{ fontWeight: isPending(header) ? '600' : '400', color: isPending(header) ? 'var(--accent-bright)' : undefined }}>
                      {getValue(header)}
                    </span>
                    {isPending(header) && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--accent-bright)' }}>
                        edited
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {empty.length > 0 && (
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                  <td
                    colSpan={2}
                    className="px-4 py-2 text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {empty.join(', ')} — empty
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div
          className="border-t px-4 py-3 flex justify-end"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-base)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all hover:opacity-90"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
