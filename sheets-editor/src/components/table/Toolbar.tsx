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
      className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 sticky top-0 z-40 transition-all duration-300"
      style={{
        background: 'linear-gradient(135deg, rgba(4,30,66,0.98) 0%, rgba(4,30,66,0.95) 50%, rgba(6,45,98,0.92) 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.15)',
        backdropFilter: 'saturate(180%) blur(20px)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      }}
    >
      {/* Left: Enhanced Brand + status */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3 group">
          <div className="relative">
            <img
              src="/NAYCA.jpg"
              alt="NAYCA Logo"
              className="w-10 h-10 rounded-xl object-cover transition-transform duration-300 group-hover:scale-105 shadow-lg"
              style={{ border: '2px solid var(--accent)', boxShadow: '0 0 20px rgba(246,181,8,0.3)' }}
            />
            <div className="absolute -inset-1 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(45deg, var(--accent), transparent)', filter: 'blur(8px)' }} />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight hidden sm:block transition-colors duration-300" style={{ fontFamily: 'var(--font-display)', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
              NAYCA 2026
            </span>
            <span className="text-xs font-medium opacity-90 hidden sm:block" style={{ color: 'rgba(255,255,255,0.8)' }}>
              Championship Schedule
            </span>
          </div>
        </div>

        {/* Enhanced Permission badge */}
        <div className="flex items-center gap-2">
          <span
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 hover:scale-105 shadow-sm"
            style={
              user.isEditor
                ? {
                    background: 'linear-gradient(135deg, var(--success-dim), var(--success))',
                    color: 'white',
                    border: '1px solid var(--success)',
                    boxShadow: '0 2px 8px rgba(21,128,61,0.3)'
                  }
                : {
                    background: 'rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.95)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(10px)'
                  }
            }
          >
            <span className="mr-1.5">{user.isEditor ? '✦' : '👁'}</span>
            {user.isEditor ? 'Editor Access' : 'View Only'}
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

      {/* Right: Enhanced Actions */}
      <div className="flex items-center gap-3">
        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh data"
          className="w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-300 hover:scale-110 hover:rotate-12 disabled:opacity-40 disabled:hover:scale-100 disabled:hover:rotate-0 shadow-lg"
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'white',
            backdropFilter: 'blur(10px)'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 ${isLoading ? 'animate-spin' : ''}`}>
            <path d="M2 8A6 6 0 1 1 8 14" />
            <polyline points="2,5 2,8 5,8" />
          </svg>
        </button>

        {/* Export button */}
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-medium transition-all duration-300 hover:scale-105 shadow-lg"
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'white',
            backdropFilter: 'blur(10px)'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 1v8M4 5l3 3 3-3M1 11v1a1 1 0 001 1h10a1 1 0 001-1v-1" />
          </svg>
          <span className="hidden sm:inline">Export</span>
        </button>

        {/* Bulk edit button */}
        {user.isEditor && selectedCount > 0 && (
          <button
            onClick={onBulkEdit}
            className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-semibold transition-all duration-300 hover:scale-105 shadow-lg"
            style={{
              background: 'linear-gradient(135deg, var(--accent-dim), var(--accent))',
              border: '1px solid var(--accent-bright)',
              color: 'white',
              boxShadow: '0 4px 12px rgba(246,181,8,0.4)'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.5 2.5l2 2-7 7H2.5v-2l7-7z" />
              <line x1="8" y1="4" x2="10" y2="6" />
            </svg>
            <span className="hidden sm:inline">Bulk Edit</span>
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs font-bold ml-1">
              {selectedCount}
            </span>
          </button>
        )}

        {/* Discard button */}
        {pendingCount > 0 && (
          <button
            onClick={onDiscard}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-medium transition-all duration-300 hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 shadow-lg"
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

        {/* Save button */}
        {user.isEditor && pendingCount > 0 && (
          <button
            onClick={onSave}
            disabled={isSaving || pendingCount === 0}
            className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold transition-all duration-300 hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed shadow-lg"
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
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4L6 9 3 6" />
              </svg>
            )}
            <span>{isSaving ? 'Saving…' : `Save (${pendingCount})`}</span>
          </button>
        )}

        {/* Enhanced User avatar */}
        <div className="ml-2 relative group">
          <button
            type="button"
            className="flex items-center gap-3 pl-3 pr-2 py-2 rounded-xl transition-all duration-300 hover:scale-105 shadow-lg"
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
              <div className="mt-2 flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  user.isEditor
                    ? 'bg-green-100 text-green-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {user.isEditor ? 'Editor' : 'Viewer'}
                </span>
              </div>
            </div>
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
    </header>
  );
}
