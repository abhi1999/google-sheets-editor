'use client';

import React from 'react';
import type { AppUser, FilterState, SortState } from '@/types';

interface ToolbarProps {
  user: AppUser;
  pendingCount: number;
  selectedCount: number;
  isSaving: boolean;
  isLoading: boolean;
  isCapturing: boolean;
  filters: FilterState;
  sortState: SortState;
  sheetOptions: Array<{ id: string; name: string; description?: string }>;
  selectedSheetKey: string;
  onSheetChange: (sheetKey: string) => void;
  onSave: () => void;
  onDiscard: () => void;
  onRefresh: () => void;
  onExport: () => void;
  onScreenshot: () => void;
  onBulkEdit: () => void;
  onSignOut: () => void;
}

export function Toolbar({
  user,
  pendingCount,
  selectedCount,
  isSaving,
  isLoading,
  isCapturing,
  filters,
  sortState,
  sheetOptions,
  selectedSheetKey,
  onSheetChange,
  onSave,
  onDiscard,
  onRefresh,
  onExport,
  onScreenshot,
  onBulkEdit,
  onSignOut,
}: ToolbarProps) {
  const activeSheetName = sheetOptions.find((option) => option.id === selectedSheetKey)?.name || 'Schedule';

  return (
    <div
      role="banner"
      className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-40 transition-all duration-300"
      style={{
        background: 'linear-gradient(135deg, rgba(4,30,66,0.98) 0%, rgba(4,30,66,0.95) 50%, rgba(6,45,98,0.92) 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.15)',
        backdropFilter: 'saturate(180%) blur(20px)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      }}
    >
      {/* Mobile: Compact Brand + Status Row */}
      <div className="flex items-center justify-between w-full sm:w-auto sm:justify-start gap-3 sm:gap-6">
        {/* Mobile-optimized Brand */}
        <div className="flex items-center gap-2 sm:gap-3 group">
          <div className="relative">
            <img
              src="/NAYCA.jpg"
              alt="NAYCA Logo"
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl object-cover transition-transform duration-300 group-hover:scale-105 shadow-lg"
              style={{ border: '2px solid var(--accent)', boxShadow: '0 0 20px rgba(246,181,8,0.3)' }}
            />
            <div className="absolute -inset-1 rounded-lg sm:rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(45deg, var(--accent), transparent)', filter: 'blur(8px)' }} />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-2">
            <span className="font-bold text-base sm:text-lg tracking-tight transition-colors duration-300" style={{ fontFamily: 'var(--font-display)', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
              NAYCA
            </span>
            <span className="text-xs font-medium opacity-90 hidden sm:block" style={{ color: 'rgba(255,255,255,0.8)' }}>
              {activeSheetName}
            </span>
          </div>
        </div>

        {/* Mobile: Permission badge in header row */}
        <div className="sm:hidden">
          <span
            className="px-2 py-1 rounded-full text-xs font-semibold transition-all duration-300 hover:scale-105 shadow-sm"
            style={
              user.isEditor
                ? { background: 'var(--success-dim)', color: 'var(--success)', border: '1px solid var(--success)' }
                : { background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.95)', border: '1px solid rgba(255,255,255,0.2)' }
            }
          >
            {user.isEditor ? '✦ Editor' : '👁 Viewer'}
          </span>
        </div>
      </div>

      {/* Center: Enhanced Pending edits indicator */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 animate-fade-in">
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 hover:scale-105 shadow-lg"
            style={{
              background: 'linear-gradient(135deg, var(--accent-dim), var(--accent))',
              border: '1px solid var(--accent-bright)',
              color: 'white',
              boxShadow: '0 4px 12px rgba(246,181,8,0.4)'
            }}
          >
            <div className="relative">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'white' }} />
              <div className="absolute inset-0 w-2 h-2 rounded-full animate-ping opacity-75" style={{ background: 'white' }} />
            </div>
            <span className="text-sm font-semibold">
              {pendingCount} unsaved change{pendingCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* Mobile/Desktop: Enhanced Actions */}
      <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto mt-2 sm:mt-0">
        {/* Refresh button - Better mobile touch target */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh data"
          className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all duration-300 hover:scale-110 hover:rotate-12 disabled:opacity-40 disabled:hover:scale-100 disabled:hover:rotate-0 shadow-lg touch-manipulation"
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'white',
            backdropFilter: 'blur(10px)'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 ${isLoading ? 'animate-spin' : ''}`}>
            <path d="M3 9A6 6 0 1 1 9 15" />
            <polyline points="3,6 3,9 6,9" />
          </svg>
        </button>

        {/* Export button - Mobile optimized */}
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-3 sm:px-4 h-11 sm:h-10 rounded-xl text-sm font-medium transition-all duration-300 hover:scale-105 shadow-lg touch-manipulation min-w-[44px]"
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'white',
            backdropFilter: 'blur(10px)'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 1v9M5 5l3 3 3-3M1 12v1a1 1 0 001 1h12a1 1 0 001-1v-1" />
          </svg>
          <span className="hidden sm:inline">Export</span>
        </button>

        {/* Screenshot button */}
        <button
          onClick={onScreenshot}
          disabled={isCapturing}
          title="Screenshot filtered table"
          className="flex items-center gap-2 px-3 sm:px-4 h-11 sm:h-10 rounded-xl text-sm font-medium transition-all duration-300 hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 shadow-lg touch-manipulation min-w-[44px]"
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'white',
            backdropFilter: 'blur(10px)'
          }}
        >
          {isCapturing ? (
            <div className="w-4 h-4 rounded-full border-2 border-white/30 animate-spin" style={{ borderTopColor: 'white' }} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2H2a1 1 0 00-1 1v9a1 1 0 001 1h12a1 1 0 001-1V3a1 1 0 00-1-1h-4" />
              <path d="M6 2a2 2 0 014 0" />
              <circle cx="8" cy="8" r="2.5" />
            </svg>
          )}
          <span className="hidden sm:inline">{isCapturing ? 'Capturing…' : 'Screenshot'}</span>
        </button>

        {/* Bulk edit button - Mobile optimized */}
        {user.isEditor && selectedCount > 0 && (
          <button
            onClick={onBulkEdit}
            className="flex items-center gap-2 px-3 sm:px-4 h-11 sm:h-10 rounded-xl text-sm font-semibold transition-all duration-300 hover:scale-105 shadow-lg touch-manipulation min-w-[44px]"
            style={{
              background: 'linear-gradient(135deg, var(--accent-dim), var(--accent))',
              border: '1px solid var(--accent-bright)',
              color: 'white',
              boxShadow: '0 4px 12px rgba(246,181,8,0.4)'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.5 3.5l2 2-8 8H2.5v-2l8-8z" />
              <line x1="9" y1="5" x2="11" y2="7" />
            </svg>
            <span className="hidden sm:inline">Bulk Edit</span>
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs font-bold ml-1">
              {selectedCount}
            </span>
          </button>
        )}

        {/* Discard button - Mobile optimized */}
        {pendingCount > 0 && (
          <button
            onClick={onDiscard}
            disabled={isSaving}
            className="flex items-center gap-2 px-3 sm:px-4 h-11 sm:h-10 rounded-xl text-sm font-medium transition-all duration-300 hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed shadow-lg touch-manipulation min-w-[44px]"
            style={{
              background: 'rgba(239,68,68,0.2)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#fca5a5',
              backdropFilter: 'blur(10px)'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 2.5l9 9M11.5 2.5l-9 9" />
            </svg>
            <span className="hidden sm:inline">Discard</span>
          </button>
        )}

        {/* Save button - Mobile optimized */}
        {user.isEditor && pendingCount > 0 && (
          <button
            onClick={onSave}
            disabled={isSaving || pendingCount === 0}
            className="flex items-center gap-2 px-3 sm:px-4 h-11 sm:h-10 rounded-xl text-sm font-bold transition-all duration-300 hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed shadow-lg touch-manipulation min-w-[44px]"
            style={{
              background: 'linear-gradient(135deg, var(--success), #16a34a)',
              border: '1px solid #22c55e',
              color: 'white',
              boxShadow: '0 4px 12px rgba(34,197,94,0.4)'
            }}
          >
            {isSaving ? (
              <div className="w-4 h-4 rounded-full border-2 border-white/30 animate-spin" style={{ borderTopColor: 'white' }} />
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 4L6 11 3 8" />
              </svg>
            )}
            <span className="hidden sm:inline">{isSaving ? 'Saving…' : `Save (${pendingCount})`}</span>
          </button>
        )}

        {/* Enhanced User avatar - Mobile optimized */}
        <div className="ml-2 relative group">
          <button
            type="button"
            className="flex items-center gap-3 pl-3 pr-2 py-2 h-11 sm:h-10 rounded-xl transition-all duration-300 hover:scale-105 shadow-lg touch-manipulation"
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.2)',
              backdropFilter: 'blur(10px)'
            }}
          >
            {user.image ? (
              <img src={user.image} alt={user.name} className="w-7 h-7 rounded-full ring-2 transition-all duration-300" style={{}} />
            ) : (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ring-2 transition-all duration-300"
                style={{
                  background: 'linear-gradient(135deg, var(--accent-dim), var(--accent))',
                  color: 'white'
                }}
              >
                {user.name[0]?.toUpperCase()}
              </div>
            )}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300 group-hover:rotate-180" style={{ color: 'white' }}>
              <polyline points="3,5 6,8 9,5" />
            </svg>
          </button>

          {/* Enhanced Dropdown */}
          <div
            className="absolute right-0 top-full mt-2 w-64 rounded-2xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 ease-out z-50 transform translate-y-2 group-hover:translate-y-0"
            style={{
              background: 'rgba(255,255,255,0.95)',
              border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.1)',
              backdropFilter: 'blur(20px)'
            }}
          >
            <div className="mb-3 pb-3 border-b border-gray-200">
              <p className="text-sm font-bold text-gray-900 mb-1">{user.name}</p>
              <p className="text-xs text-gray-600">{user.email}</p>
              <div className="mt-2 flex flex-col gap-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  user.isEditor
                    ? 'bg-green-100 text-green-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {user.isEditor ? 'Editor' : 'Viewer'}
                </span>
                <div>
                  <label htmlFor="toolbar-sheet-select" className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-1">
                    Active sheet
                  </label>
                  <select
                    id="toolbar-sheet-select"
                    value={selectedSheetKey}
                    onChange={(event) => onSheetChange(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
                  >
                    {sheetOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name || option.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <a
              href="/scout"
              className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-gray-100 flex items-center gap-2 no-underline mb-1"
              style={{ color: '#1a1a1a' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M4.93 4.93c4.3 4.3 9.84 4.3 14.14 0" />
                <path d="M4.93 19.07c4.3-4.3 9.84-4.3 14.14 0" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <line x1="12" y1="2" x2="12" y2="22" />
              </svg>
              ScoutBoard U15
            </a>
            <a
              href="/scout/u13"
              className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-gray-100 flex items-center gap-2 no-underline mb-1"
              style={{ color: '#1a1a1a' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M4.93 4.93c4.3 4.3 9.84 4.3 14.14 0" />
                <path d="M4.93 19.07c4.3-4.3 9.84-4.3 14.14 0" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <line x1="12" y1="2" x2="12" y2="22" />
              </svg>
              ScoutBoard U13
            </a>
            <a
              href="/scout/demo"
              className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-gray-100 flex items-center gap-2 no-underline mb-1"
              style={{ color: '#9a7d2a' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Scout Demo
            </a>
            <button
              onClick={onSignOut}
              className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-red-50 hover:text-red-700 flex items-center gap-2"
              style={{ color: 'var(--danger)' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.5 3.5L3.5 10.5M3.5 3.5l7 7" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
