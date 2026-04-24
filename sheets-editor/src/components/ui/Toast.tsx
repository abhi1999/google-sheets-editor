'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast-${++counterRef.current}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-2"
        style={{ maxWidth: '360px' }}
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => setToasts((p) => p.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const TOAST_STYLES: Record<ToastType, { bg: string; border: string; icon: React.ReactNode }> = {
  success: {
    bg: 'var(--success-dim)',
    border: 'var(--success)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--success)', flexShrink: 0 }}>
        <path d="M13 4L6 11l-3-3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  error: {
    bg: 'var(--danger-dim)',
    border: 'var(--danger)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--danger)', flexShrink: 0 }}>
        <circle cx="8" cy="8" r="6" />
        <line x1="8" y1="5" x2="8" y2="8" strokeLinecap="round" />
        <circle cx="8" cy="11" r="0.5" fill="currentColor" />
      </svg>
    ),
  },
  warning: {
    bg: 'var(--warning-dim)',
    border: 'var(--warning)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--warning)', flexShrink: 0 }}>
        <path d="M8 2L14 13H2L8 2z" strokeLinejoin="round" />
        <line x1="8" y1="7" x2="8" y2="10" strokeLinecap="round" />
        <circle cx="8" cy="12" r="0.5" fill="currentColor" />
      </svg>
    ),
  },
  info: {
    bg: 'var(--accent-dim)',
    border: 'var(--accent)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--accent-bright)', flexShrink: 0 }}>
        <circle cx="8" cy="8" r="6" />
        <line x1="8" y1="8" x2="8" y2="11" strokeLinecap="round" />
        <circle cx="8" cy="5.5" r="0.5" fill="currentColor" />
      </svg>
    ),
  },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const style = TOAST_STYLES[toast.type];
  return (
    <div
      className="toast-enter flex items-start gap-3 rounded-xl px-4 py-3 shadow-xl text-sm"
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: 'var(--text-primary)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {style.icon}
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={onDismiss}
        className="opacity-50 hover:opacity-100 transition-opacity ml-2 mt-0.5"
        style={{ color: 'var(--text-secondary)' }}
        aria-label="Dismiss"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="2" y1="2" x2="10" y2="10" strokeLinecap="round" />
          <line x1="10" y1="2" x2="2" y2="10" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
