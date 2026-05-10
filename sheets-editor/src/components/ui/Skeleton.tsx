'use client';

// Deterministic widths so SSR and client render the same values.
const HEADER_WIDTHS = [100, 80, 120, 90, 110, 95, 85, 105, 75, 115];
const CELL_WIDTHS   = [80, 140, 60, 120, 100, 70, 130, 90, 110, 65];

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="skeleton w-4 h-4 rounded" />
        <div className="skeleton w-6 h-4 rounded" />
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="skeleton h-4 rounded flex-1" style={{ maxWidth: `${HEADER_WIDTHS[i % HEADER_WIDTHS.length]}px` }} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex gap-4 px-4 py-3"
          style={{ borderBottom: '1px solid var(--border)', opacity: 1 - rowIdx * 0.08 }}
        >
          <div className="skeleton w-4 h-4 rounded" />
          <div className="skeleton w-6 h-4 rounded" />
          {Array.from({ length: cols }).map((_, colIdx) => (
            <div key={colIdx} className="skeleton h-4 rounded flex-1" style={{ maxWidth: `${CELL_WIDTHS[(rowIdx + colIdx) % CELL_WIDTHS.length]}px` }} />
          ))}
        </div>
      ))}
    </div>
  );
}
