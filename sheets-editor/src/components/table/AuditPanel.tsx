'use client';

import React, { useState, useEffect } from 'react';

interface AuditEntry {
  id: string;
  timestamp: string;
  userEmail: string;
  userName: string;
  rowIndex: string;
  column: string;
  oldValue: string;
  newValue: string;
  status: string;
}

interface AuditPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuditPanel({ isOpen, onClose }: AuditPanelProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/audit')
        .then((r) => r.json())
        .then((data) => setEntries(data.entries || []))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="h-full w-full max-w-lg flex flex-col animate-slide-in"
        style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
              Audit Log
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {entries.length} recent changes
            </p>
          </div>
          <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity" style={{ color: 'var(--text-secondary)' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="3" x2="13" y2="13" />
              <line x1="13" y1="3" x2="3" y2="13" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 rounded-full border-2 spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
              <p className="text-sm">No audit entries yet</p>
              <p className="text-xs mt-1">Changes will appear here once edits are made</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <AuditEntryCard key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AuditEntryCard({ entry }: { entry: AuditEntry }) {
  const date = new Date(entry.timestamp);
  const timeStr = isNaN(date.getTime()) ? entry.timestamp : date.toLocaleString();

  return (
    <div
      className="rounded-xl p-3.5 text-xs space-y-2"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      {/* Top row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center font-medium text-xs"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent-bright)' }}
          >
            {entry.userName?.[0]?.toUpperCase() || '?'}
          </div>
          <span style={{ color: 'var(--text-secondary)' }}>{entry.userEmail}</span>
        </div>
        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
          {timeStr}
        </span>
      </div>

      {/* Change details */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="px-1.5 py-0.5 rounded font-mono"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent-bright)' }}
        >
          {entry.column}
        </span>
        <span style={{ color: 'var(--text-muted)' }}>Row {entry.rowIndex}</span>
      </div>

      {/* Value change */}
      <div className="flex items-center gap-2 text-xs">
        <span
          className="px-2 py-1 rounded flex-1 truncate font-mono"
          style={{
            background: 'var(--danger-dim)',
            color: 'var(--danger)',
            textDecoration: 'line-through',
            opacity: 0.8,
          }}
        >
          {entry.oldValue || '(empty)'}
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          <line x1="2" y1="5" x2="8" y2="5" strokeLinecap="round" />
          <polyline points="6,3 8,5 6,7" strokeLinejoin="round" />
        </svg>
        <span
          className="px-2 py-1 rounded flex-1 truncate font-mono"
          style={{ background: 'var(--success-dim)', color: 'var(--success)' }}
        >
          {entry.newValue || '(empty)'}
        </span>
      </div>
    </div>
  );
}
