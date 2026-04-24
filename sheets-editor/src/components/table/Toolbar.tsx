'use client';

import React from 'react';
import type { AppUser, FilterState, SortState } from '@/types';

interface ToolbarProps {
  user: AppUser;
  pendingCount: number;
  selectedCount: number;
  isSaving: boolean;
  isLoading: boolean;
  filters: FilterState;
  sortState: SortState;
  onSave: () => void;
  onDiscard: () => void;
  onRefresh: () => void;
  onExport: () => void;
  onBulkEdit: () => void;
  onSignOut: () => void;
}

export function Toolbar({
  user,
  pendingCount,
  selectedCount,
  isSaving,
  isLoading,
  filters,
  sortState,
  onSave,
  onDiscard,
  onRefresh,
  onExport,
  onBulkEdit,
  onSignOut,
}: ToolbarProps) {
  return (
    <header
      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sticky top-0 z-40"
      style={{
        background: 'rgba(8,12,20,0.95)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Left: Brand + status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--accent-bright)' }}>
              <rect x="2" y="2" width="12" height="12" rx="1.5" />
              <line x1="2" y1="6" x2="14" y2="6" />
              <line x1="2" y1="10" x2="14" y2="10" />
              <line x1="6" y1="6" x2="6" y2="14" />
            </svg>
          </div>
          <span className="font-semibold text-sm hidden sm:block" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            Sheet Editor
          </span>
        </div>

        {/* Permission badge */}
        <span
          className="px-2 py-0.5 rounded-full text-xs font-medium"
          style={
            user.isEditor
              ? { background: 'var(--success-dim)', color: 'var(--success)', border: '1px solid var(--success)' }
              : { background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
          }
        >
          {user.isEditor ? '✦ Editor' : '◎ Viewer'}
        </span>
      </div>

      {/* Center: Pending edits */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--accent-bright)' }}
          >
            <div className="w-1.5 h-1.5 rounded-full animate-pulse-subtle" style={{ background: 'var(--accent-bright)' }} />
            {pendingCount} unsaved change{pendingCount !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Refresh */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh data"
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:opacity-80 disabled:opacity-40"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={isLoading ? 'spin' : ''}>
            <path d="M2 7A5 5 0 1 1 7 12" />
            <polyline points="2,4 2,7 5,7" />
          </svg>
        </button>

        {/* Export */}
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 1v7M3 5l3 3 3-3M1 9v1a1 1 0 001 1h8a1 1 0 001-1V9" />
          </svg>
          <span className="hidden sm:inline">Export CSV</span>
        </button>

        {/* Bulk edit (only shown when rows selected and is editor) */}
        {user.isEditor && selectedCount > 0 && (
          <button
            onClick={onBulkEdit}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
            style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--accent-bright)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8.5 1.5l2 2-6 6H2.5v-2l6-6z" />
              <line x1="7" y1="3" x2="9" y2="5" />
            </svg>
            Bulk edit {selectedCount}
          </button>
        )}

        {/* Discard */}
        {pendingCount > 0 && (
          <button
            onClick={onDiscard}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium transition-colors hover:opacity-80 disabled:opacity-40"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            Discard
          </button>
        )}

        {/* Save */}
        {user.isEditor && pendingCount > 0 && (
          <button
            onClick={onSave}
            disabled={isSaving || pendingCount === 0}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--accent)', color: 'white', border: 'none' }}
          >
            {isSaving ? (
              <div className="w-3 h-3 rounded-full border border-white/30 spin" style={{ borderTopColor: 'white' }} />
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 3L5 9 2 6" />
              </svg>
            )}
            {isSaving ? 'Saving…' : `Save ${pendingCount}`}
          </button>
        )}

        {/* User avatar */}
        <div className="ml-1 relative group">
          <button className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg transition-colors hover:opacity-80" style={{ border: '1px solid transparent' }}>
            {user.image ? (
              <img src={user.image} alt={user.name} className="w-6 h-6 rounded-full" />
            ) : (
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                style={{ background: 'var(--accent-dim)', color: 'var(--accent-bright)' }}
              >
                {user.name[0]?.toUpperCase()}
              </div>
            )}
          </button>
          {/* Dropdown */}
          <div
            className="absolute right-0 top-full mt-2 w-56 rounded-xl p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-50"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
          >
            <div className="mb-2 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user.name}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
            </div>
            <button
              onClick={onSignOut}
              className="w-full text-left px-2 py-1.5 rounded text-xs transition-colors hover:opacity-80"
              style={{ color: 'var(--danger)' }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
