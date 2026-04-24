'use client';

interface PaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZES = [10, 25, 50, 100];

export function Pagination({
  page,
  totalPages,
  pageSize,
  totalRows,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalRows);

  const pages = getPageNumbers(page, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-1 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
      {/* Info + page size */}
      <div className="flex items-center gap-3">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {totalRows === 0 ? 'No rows' : `${start}–${end} of ${totalRows}`}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Per page:</span>
          <select
            value={pageSize}
            onChange={(e) => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
            className="rounded px-2 py-1 text-xs"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Page buttons */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <NavBtn disabled={page === 1} onClick={() => onPageChange(1)} title="First">
            «
          </NavBtn>
          <NavBtn disabled={page === 1} onClick={() => onPageChange(page - 1)} title="Previous">
            ‹
          </NavBtn>

          {pages.map((p, i) =>
            p === '...' ? (
              <span key={`ellipsis-${i}`} className="px-2 py-1 text-xs" style={{ color: 'var(--text-muted)' }}>…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(Number(p))}
                className="min-w-[28px] h-7 px-2 rounded text-xs font-medium transition-colors"
                style={{
                  background: p === page ? 'var(--accent)' : 'var(--bg-elevated)',
                  border: `1px solid ${p === page ? 'var(--accent)' : 'var(--border)'}`,
                  color: p === page ? 'white' : 'var(--text-secondary)',
                }}
              >
                {p}
              </button>
            )
          )}

          <NavBtn disabled={page === totalPages} onClick={() => onPageChange(page + 1)} title="Next">
            ›
          </NavBtn>
          <NavBtn disabled={page === totalPages} onClick={() => onPageChange(totalPages)} title="Last">
            »
          </NavBtn>
        </div>
      )}
    </div>
  );
}

function NavBtn({ children, disabled, onClick, title }: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="min-w-[28px] h-7 px-2 rounded text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        color: 'var(--text-secondary)',
      }}
    >
      {children}
    </button>
  );
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | '...')[] = [];
  pages.push(1);

  if (current > 3) pages.push('...');

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push('...');
  pages.push(total);

  return pages;
}
