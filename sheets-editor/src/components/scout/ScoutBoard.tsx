'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import type { ScoutPlayer, PlayerEvaluation, SchemaType, CoachEval } from '@/types/scout';
import type { AppUser } from '@/types';
import { SCHEMAS, FITNESS_FIELDS, calcScore, getRating, playerInitials, type SectionDef } from '@/lib/scout-schemas';
import Papa from 'papaparse';
import { PlayerModal } from './PlayerModal';
import { TeamSelectionBoard } from './TeamSelectionBoard';

interface ScoutBoardProps {
  sheetKey: string;
  user: AppUser;
}

interface CategoryGroup {
  name: string;
  players: ScoutPlayer[];
}

function groupByCategory(players: ScoutPlayer[]): CategoryGroup[] {
  const map = new Map<string, ScoutPlayer[]>();
  for (const p of players) {
    const key = p.category || 'Uncategorised';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return Array.from(map.entries()).map(([name, ps]) => ({ name, players: ps }));
}

function isEvaluated(player: ScoutPlayer): boolean {
  return player.coachEvals.length > 0;
}

function getCategoryColor(category: string): { bg: string; text: string } {
  const c = category.toLowerCase();
  if (c.includes('wicket') || c.includes('keeper') || c.includes('wk'))
    return { bg: '#00695c', text: '#fff' };
  if (c.includes('allrounder') || c.includes('all-rounder') || c.includes('all rounder'))
    return { bg: '#6a1b9a', text: '#fff' };
  if (c.includes('batter') || c.includes('batsman'))
    return { bg: '#1565c0', text: '#fff' };
  if (c.includes('bowler'))
    return { bg: '#bf360c', text: '#fff' };
  return { bg: '#2e4030', text: '#f5f0e8' };
}

function getDivStyle(div: string): { bg: string; text: string } | null {
  if (!div) return null;
  const d = div.trim().toUpperCase();
  if (d === 'A' || d === 'DIV A' || d === 'DIVISION A') return { bg: '#c8a84b', text: '#1a1a1a' };
  if (d === 'B' || d === 'DIV B' || d === 'DIVISION B') return { bg: '#546e7a', text: '#fff' };
  return { bg: '#5d4037', text: '#fff' };
}

function getYoYoBadge(coachEvals: ScoutPlayer['coachEvals']): { best: number; bg: string; text: string } | null {
  const vals = coachEvals
    .map((e) => parseFloat(e.evaluation.fitness?.['Yo-Yo'] || ''))
    .filter((v) => !isNaN(v) && v > 0);
  if (vals.length === 0) return null;
  const best = Math.min(...vals);
  if (best >= 15.5) return { best, bg: '#1b5e20', text: '#a5d6a7' };
  if (best >= 15.2) return { best, bg: '#7f3f00', text: '#ffcc80' };
  return { best, bg: '#7f1f1f', text: '#ef9a9a' };
}

function matchesSearch(p: ScoutPlayer, q: string): boolean {
  return (
    p.name.toLowerCase().includes(q) ||
    p.category.toLowerCase().includes(q) ||
    p.batch.toLowerCase().includes(q) ||
    p.schema.toLowerCase().includes(q) ||
    p.div.toLowerCase().includes(q)
  );
}

// ── Sub-components ────────────────────────────────────────────────────

function PinIcon({ pinned }: { pinned: boolean }) {
  return (
    <svg
      width="13" height="13" viewBox="0 0 24 24"
      fill={pinned ? '#c0392b' : 'none'}
      stroke={pinned ? '#c0392b' : 'rgba(80,80,80,0.8)'}
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    >
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z" />
    </svg>
  );
}

function PlayerCard({
  player,
  onClick,
  isPinned,
  onTogglePin,
  showBatch,
  userEmail,
}: {
  player: ScoutPlayer;
  onClick: () => void;
  isPinned: boolean;
  onTogglePin: (rowIndex: number) => void;
  showBatch?: boolean;
  userEmail: string;
}) {
  const catColor = getCategoryColor(player.category);
  const divStyle = getDivStyle(player.div);

  return (
    <button
      onClick={onClick}
      className="relative overflow-hidden rounded-lg text-center cursor-pointer border-2 transition-all duration-150"
      style={{
        background: '#f5f0e8',
        borderColor: isPinned ? '#c0392b' : 'transparent',
        padding: '16px 10px 12px',
        fontFamily: 'Barlow, sans-serif',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#c0392b';
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = isPinned ? '#c0392b' : 'transparent';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Decorative circle */}
      <span className="absolute -top-4 -right-4 w-12 h-12 rounded-full pointer-events-none"
        style={{ background: 'rgba(192,57,43,0.06)' }} />

      {/* Pin button */}
      <span
        className="absolute top-1.5 left-1.5 p-1 rounded transition-opacity"
        style={{ opacity: isPinned ? 1 : 0.25 }}
        title={isPinned ? 'Unpin' : 'Pin player'}
        onClick={(e) => { e.stopPropagation(); onTogglePin(player.rowIndex); }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = isPinned ? '1' : '0.25'; }}
      >
        <PinIcon pinned={isPinned} />
      </span>

      {/* Avatar */}
      <div
        className="w-11 h-11 rounded-full mx-auto mb-2 flex items-center justify-center text-base font-bold"
        style={{ background: catColor.bg, color: catColor.text, fontFamily: 'Barlow Condensed, sans-serif' }}
      >
        {playerInitials(player.name)}
      </div>

      {/* Name + Div */}
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        <span className="text-sm font-bold uppercase tracking-tight leading-tight"
          style={{ color: '#1a1a1a', fontFamily: 'Barlow Condensed, sans-serif' }}>
          {player.name}
        </span>
        {divStyle && (
          <span className="text-[9px] font-bold px-1.5 rounded leading-4 flex-shrink-0"
            style={{ background: divStyle.bg, color: divStyle.text, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em' }}>
            {player.div}
          </span>
        )}
      </div>

      {/* Category */}
      <div className="flex items-center justify-center gap-1 mt-0.5">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: catColor.bg }} />
        <span className="text-xs truncate opacity-55" style={{ color: '#4a4a4a' }}>
          {player.category || player.schema}
        </span>
      </div>

      {/* Batch badge (only shown in search/pinned cross-batch views) */}
      {showBatch && player.batch && (
        <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-px rounded"
          style={{
            fontFamily: 'Barlow Condensed, sans-serif',
            background: 'rgba(0,0,0,0.08)',
            color: '#4a4a4a',
            letterSpacing: '0.04em',
          }}>
          {player.batch}
        </span>
      )}

      {/* Score badge */}
      {(() => {
        const n = player.coachEvals.length;
        return (
          <span className="inline-block mt-1.5 text-xs font-bold px-2 py-0.5 rounded-full"
            style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              background: n > 0 ? '#1a2e1a' : '#e8e0d0',
              color: n > 0 ? '#f5f0e8' : '#4a4a4a',
            }}>
            {n > 0
              ? `${n} coach${n !== 1 ? 'es' : ''} · avg ${player.aggregatePct}%`
              : 'Not scored'}
          </span>
        );
      })()}
      {player.myEval !== null && (
        <div className="text-[9px] mt-0.5 font-semibold" style={{ color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.04em' }}>
          ✓ you rated
        </div>
      )}
      {(() => {
        const yoyo = getYoYoBadge(player.coachEvals);
        return yoyo ? (
          <div
            className="inline-block mt-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: yoyo.bg, color: yoyo.text, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.06em' }}
          >
            YO-YO {yoyo.best}
          </div>
        ) : (
          <div
            className="inline-block mt-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(0,0,0,0.07)', color: 'rgba(74,74,74,0.5)', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.06em' }}
          >
            YO-YO —
          </div>
        );
      })()}
    </button>
  );
}

function SectionHeader({ label, count, icon }: {
  label: string; count: number; icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 border rounded-sm flex-shrink-0"
        style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#c0392b', borderColor: '#c0392b' }}>
        {count} Players
      </span>
      {icon}
      <h2 className="text-2xl font-extrabold uppercase tracking-tight flex-shrink-0"
        style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#f5f0e8' }}>
        {label}
      </h2>
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, rgba(192,57,43,0.3), transparent)' }} />
    </div>
  );
}

function PlayerGrid({ players, pinnedIds, onCardClick, onTogglePin, showBatch, userEmail }: {
  players: ScoutPlayer[];
  pinnedIds: Set<number>;
  onCardClick: (p: ScoutPlayer) => void;
  onTogglePin: (rowIndex: number) => void;
  showBatch?: boolean;
  userEmail: string;
}) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(138px, 1fr))' }}>
      {players.map((p) => (
        <PlayerCard
          key={p.rowIndex}
          player={p}
          onClick={() => onCardClick(p)}
          isPinned={pinnedIds.has(p.rowIndex)}
          onTogglePin={onTogglePin}
          showBatch={showBatch}
          userEmail={userEmail}
        />
      ))}
    </div>
  );
}

// ── Shared sort + search utilities ───────────────────────────────────

function useSortSearch() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ col: string | null; dir: 'asc' | 'desc' }>({ col: null, dir: 'asc' });
  const toggleSort = useCallback((col: string) => {
    setSort((prev) => ({
      col,
      dir: prev.col === col ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'asc',
    }));
  }, []);
  return { search, setSearch, sortCol: sort.col, sortDir: sort.dir, toggleSort };
}

function applySort<T>(rows: T[], col: string | null, dir: 'asc' | 'desc', val: (r: T, c: string) => string | number): T[] {
  if (!col) return rows;
  const d = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = val(a, col), bv = val(b, col);
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * d;
    return String(av).localeCompare(String(bv)) * d;
  });
}

function TableSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative flex-shrink-0" style={{ minWidth: '160px', maxWidth: '240px', width: '100%' }}>
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'rgba(245,240,232,0.3)' }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </span>
      <input
        type="text" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="Search players…"
        style={{ width: '100%', paddingLeft: '1.6rem', paddingRight: '1.5rem', paddingTop: '0.375rem', paddingBottom: '0.375rem',
          borderRadius: '0.375rem', fontSize: '0.75rem', background: 'rgba(0,0,0,0.2)', color: '#f5f0e8',
          border: '1px solid rgba(245,240,232,0.12)', fontFamily: 'Barlow, sans-serif', outline: 'none' }}
      />
      {value && (
        <button onClick={() => onChange('')} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
          color: 'rgba(245,240,232,0.4)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>✕</button>
      )}
    </div>
  );
}

function SortTh({ label, col, sortCol, sortDir, onSort, className, style, title }: {
  label: string; col: string; sortCol: string | null; sortDir: 'asc' | 'desc';
  onSort: (col: string) => void; className?: string; style?: React.CSSProperties; title?: string;
}) {
  const active = sortCol === col;
  return (
    <th title={title} onClick={() => onSort(col)} className={`cursor-pointer select-none ${className || ''}`}
      style={{ ...style, userSelect: 'none' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
        {label}
        <span style={{ opacity: active ? 1 : 0.22, fontSize: '0.55rem', color: active ? '#c8a84b' : 'inherit', lineHeight: 1 }}>
          {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </span>
    </th>
  );
}

const EXPORT_ICON = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 1v9M5 5l3 3 3-3M1 12v1a1 1 0 001 1h12a1 1 0 001-1v-1" />
  </svg>
);

const EXPORT_BTN_STYLE: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.5rem',
  padding: '0.375rem 0.75rem', borderRadius: '0.25rem',
  fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
  fontFamily: 'Barlow Condensed, sans-serif',
  background: 'rgba(200,168,75,0.15)', color: '#c8a84b',
  border: '1px solid rgba(200,168,75,0.3)', cursor: 'pointer', flexShrink: 0,
};

const TH_BASE = 'px-4 py-3 text-left text-xs font-bold uppercase tracking-widest whitespace-nowrap';
const TH_STYLE: React.CSSProperties = { fontFamily: 'Barlow Condensed, sans-serif', color: 'rgba(245,240,232,0.55)' };
const TR_HEAD: React.CSSProperties = { background: '#1d2e1e', borderBottom: '2px solid rgba(192,57,43,0.4)' };
const TD_ALT = (i: number): React.CSSProperties => ({ background: i % 2 === 0 ? '#1a2a1a' : '#1d2e1e', borderBottom: '1px solid rgba(200,168,75,0.07)' });

// ─────────────────────────────────────────────────────────────────────

function MyEvalsTable({
  players,
  onRowClick,
}: {
  players: ScoutPlayer[];
  onRowClick: (p: ScoutPlayer) => void;
}) {
  const myEvalPlayers = useMemo(
    () => players.filter((p) => p.myEval !== null),
    [players]
  );

  const schemaKeys = Object.keys(SCHEMAS) as SchemaType[];
  const schemaLabels: Record<SchemaType, string> = {
    Batsman: 'BAT',
    'Fast Bowler': 'FB',
    'Spin Bowler': 'SB',
  };
  const schemaColors: Record<SchemaType, string> = {
    Batsman: '#1565c0',
    'Fast Bowler': '#bf360c',
    'Spin Bowler': '#6a1b9a',
  };

  const { search, setSearch, sortCol, sortDir, toggleSort } = useSortSearch();
  const displayRows = useMemo(() => {
    const q = search.toLowerCase();
    const base = q
      ? myEvalPlayers.filter((p) =>
          p.name.toLowerCase().includes(q) ||
          (p.batch || '').toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q)
        )
      : myEvalPlayers;
    return applySort(base, sortCol, sortDir, (p, col) => {
      if (col === 'Player') return p.name;
      if (col === 'Batch') return p.batch || '';
      if (col === 'Category') return p.category || '';
      if (col === 'BAT') return calcScore(p.myEval!.evaluation, SCHEMAS['Batsman']).pct;
      if (col === 'FB') return calcScore(p.myEval!.evaluation, SCHEMAS['Fast Bowler']).pct;
      if (col === 'SB') return calcScore(p.myEval!.evaluation, SCHEMAS['Spin Bowler']).pct;
      if (col === 'Remarks') return p.myEval!.remarks || '';
      if (col === 'Date') return p.myEval!.savedAt || '';
      return '';
    });
  }, [myEvalPlayers, search, sortCol, sortDir]);

  if (myEvalPlayers.length === 0) {
    return (
      <div className="rounded-lg border p-10 text-center mt-4"
        style={{ background: '#243324', borderColor: 'rgba(200,168,75,0.15)' }}>
        <p className="text-lg font-bold mb-1"
          style={{ color: '#f5f0e8', fontFamily: 'Barlow Condensed, sans-serif' }}>
          No evaluations yet
        </p>
        <p className="text-sm" style={{ color: 'rgba(245,240,232,0.45)' }}>
          Open a player card and submit a rating to see your evaluations here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <TableSearch value={search} onChange={setSearch} />
        <span className="text-xs flex-1" style={{ color: 'rgba(245,240,232,0.4)', fontFamily: 'Barlow Condensed, sans-serif' }}>
          {displayRows.length} of {myEvalPlayers.length} evaluated · click row to edit
        </span>
        <button onClick={() => exportMyEvalsToCSV(players)} style={EXPORT_BTN_STYLE} className="transition-opacity hover:opacity-80">
          {EXPORT_ICON} Export CSV
        </button>
      </div>
    <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(200,168,75,0.15)' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={TR_HEAD}>
              {(['Player', 'Batch', 'Category'] as string[]).concat(schemaKeys.map((s) => schemaLabels[s])).concat(['Remarks', 'Date']).map((h) => (
                <SortTh key={h} label={h} col={h} sortCol={sortCol} sortDir={sortDir} onSort={toggleSort}
                  className={TH_BASE} style={TH_STYLE} />
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((p, i) => {
              const ev = p.myEval!;
              const scores = schemaKeys.map((s) => ({
                key: s,
                pct: calcScore(ev.evaluation, SCHEMAS[s]).pct,
              }));
              return (
                <tr
                  key={p.rowIndex}
                  onClick={() => onRowClick(p)}
                  className="cursor-pointer transition-colors"
                  style={{
                    background: i % 2 === 0 ? '#1a2a1a' : '#1d2e1e',
                    borderBottom: '1px solid rgba(200,168,75,0.08)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(192,57,43,0.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? '#1a2a1a' : '#1d2e1e')}
                >
                  <td className="px-4 py-3">
                    <span className="font-bold" style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#f5f0e8' }}>
                      {p.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs" style={{ color: 'rgba(245,240,232,0.5)', fontFamily: 'Barlow Condensed, sans-serif' }}>
                      {p.batch || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold" style={{ color: 'rgba(245,240,232,0.7)', fontFamily: 'Barlow Condensed, sans-serif' }}>
                      {p.category || '—'}
                    </span>
                  </td>
                  {scores.map(({ key, pct }) => (
                    <td key={key} className="px-4 py-3">
                      <span
                        className="font-bold text-sm"
                        style={{
                          fontFamily: 'Barlow Condensed, sans-serif',
                          color: pct > 0 ? schemaColors[key] : 'rgba(245,240,232,0.2)',
                        }}
                      >
                        {pct > 0 ? `${pct}%` : '—'}
                      </span>
                    </td>
                  ))}
                  <td className="px-4 py-3 max-w-[220px]">
                    <span className="text-xs line-clamp-2" style={{ color: 'rgba(245,240,232,0.55)' }}>
                      {ev.remarks || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs" style={{ color: 'rgba(245,240,232,0.35)', fontFamily: 'Barlow Condensed, sans-serif' }}>
                      {ev.savedAt ? new Date(ev.savedAt).toLocaleDateString() : '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────

function sectionScore(sec: SectionDef, skills: Record<string, number>) {
  let wScore = 0, maxW = 0;
  sec.skills.forEach((sk) => { wScore += (skills[sk.name] || 0) * sk.weight; maxW += 5 * sk.weight; });
  return { wScore, maxW };
}

type SchemaSection = { schemaName: SchemaType; schemaLabel: string; section: SectionDef };

const ALL_SCHEMA_SECTIONS: SchemaSection[] = (Object.entries(SCHEMAS) as [SchemaType, (typeof SCHEMAS)[SchemaType]][]).flatMap(
  ([schemaName, def]) => def.sections.map((section) => ({
    schemaName,
    schemaLabel: schemaName === 'Batsman' ? 'BAT' : schemaName === 'Fast Bowler' ? 'FB' : 'SB',
    section,
  }))
);

const SCHEMA_COLORS: Record<SchemaType, string> = {
  Batsman: '#1565c0',
  'Fast Bowler': '#bf360c',
  'Spin Bowler': '#6a1b9a',
};

function exportMyEvalsToCSV(players: ScoutPlayer[]) {
  const schemaKeys = Object.keys(SCHEMAS) as SchemaType[];
  const schemaLabels: Record<SchemaType, string> = { Batsman: 'BAT', 'Fast Bowler': 'FB', 'Spin Bowler': 'SB' };
  const myEvalPlayers = players.filter((p) => p.myEval !== null);
  const rows = myEvalPlayers.map((p) => {
    const row: Record<string, string | number> = {
      Player: p.name,
      Batch: p.batch || '',
      Category: p.category || '',
    };
    schemaKeys.forEach((s) => {
      row[`${schemaLabels[s]} %`] = calcScore(p.myEval!.evaluation, SCHEMAS[s]).pct;
    });
    row['Remarks'] = p.myEval!.remarks || '';
    row['Date'] = p.myEval!.savedAt ? new Date(p.myEval!.savedAt).toLocaleDateString() : '';
    return row;
  });
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `my-evals-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportToCSV(players: ScoutPlayer[]) {
  const myEvalPlayers = players.filter((p) => p.myEval !== null);
  const rows = myEvalPlayers.map((p) => {
    const skills = p.myEval!.evaluation.skills;
    const row: Record<string, string | number> = {
      Player: p.name,
      Batch: p.batch || '',
      Category: p.category || '',
    };
    ALL_SCHEMA_SECTIONS.forEach(({ schemaLabel, section }) => {
      const { wScore, maxW } = sectionScore(section, skills);
      row[`${schemaLabel} ${section.letter}: ${section.name}`] = wScore;
      row[`${schemaLabel} ${section.letter} Max`] = maxW;
    });
    row['Remarks'] = p.myEval!.remarks || '';
    row['Date'] = p.myEval!.savedAt ? new Date(p.myEval!.savedAt).toLocaleDateString() : '';
    return row;
  });
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `my-evaluations-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function SchemaHelpModal({ schemaName, onClose }: { schemaName: SchemaType; onClose: () => void }) {
  const def = SCHEMAS[schemaName];
  const color = SCHEMA_COLORS[schemaName];
  const label = schemaName === 'Batsman' ? 'BAT' : schemaName === 'Fast Bowler' ? 'FB' : 'SB';
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.78)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl flex flex-col"
        style={{ background: '#18261a', border: `2px solid ${color}`, width: '100%', maxWidth: '540px', maxHeight: '82vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 rounded-t-xl" style={{ background: color }}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-70" style={{ color: '#fff', fontFamily: 'Barlow Condensed, sans-serif' }}>
              Schema Guide · Skills scored 1–5
            </div>
            <div className="text-base font-extrabold uppercase tracking-wider" style={{ color: '#fff', fontFamily: 'Barlow Condensed, sans-serif' }}>
              {label} — {schemaName}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: '1.1rem', lineHeight: 1, padding: '4px 6px' }}>✕</button>
        </div>

        {/* Sections */}
        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {def.sections.map((sec) => {
            const maxPts = sec.skills.reduce((s, sk) => s + 5 * sk.weight, 0);
            return (
              <div key={sec.letter}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ background: color, color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.06em' }}
                  >
                    {label}{sec.letter}
                  </span>
                  <span className="text-sm font-bold uppercase tracking-wide" style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#f5f0e8' }}>
                    {sec.name}
                  </span>
                  <span className="text-[10px] ml-auto flex-shrink-0" style={{ color: 'rgba(245,240,232,0.3)', fontFamily: 'Barlow Condensed, sans-serif' }}>
                    max {maxPts} pts
                  </span>
                </div>
                <div className="space-y-0.5 pl-1 border-l-2" style={{ borderColor: `${color}55` }}>
                  {sec.skills.map((sk) => (
                    <div key={sk.name} className="flex items-start gap-2 py-0.5">
                      <span
                        className="text-[9px] font-bold px-1 py-px rounded flex-shrink-0 mt-px"
                        style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(245,240,232,0.4)', fontFamily: 'Barlow Condensed, sans-serif' }}
                      >
                        ×{sk.weight}
                      </span>
                      <div className="min-w-0">
                        <span className="text-xs font-semibold" style={{ color: '#f5f0e8', fontFamily: 'Barlow Condensed, sans-serif' }}>
                          {sk.name}
                        </span>
                        {sk.desc && (
                          <span className="text-xs ml-1.5" style={{ color: 'rgba(245,240,232,0.4)' }}>
                            — {sk.desc}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MyEvalDetailsTable({
  players,
  onRowClick,
}: {
  players: ScoutPlayer[];
  onRowClick: (p: ScoutPlayer) => void;
}) {
  const myEvalPlayers = useMemo(() => players.filter((p) => p.myEval !== null), [players]);

  const { search, setSearch, sortCol, sortDir, toggleSort } = useSortSearch();
  const displayRows = useMemo(() => {
    const q = search.toLowerCase();
    const base = q
      ? myEvalPlayers.filter((p) =>
          p.name.toLowerCase().includes(q) ||
          (p.batch || '').toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q)
        )
      : myEvalPlayers;
    return applySort(base, sortCol, sortDir, (p, col) => {
      if (col === 'Player') return p.name;
      if (col === 'Batch') return p.batch || '';
      if (col === 'Category') return p.category || '';
      if (col === 'Remarks') return p.myEval!.remarks || '';
      if (col === 'Date') return p.myEval!.savedAt || '';
      const skills = p.myEval!.evaluation.skills;
      for (const { schemaLabel, section } of ALL_SCHEMA_SECTIONS) {
        if (col === `${schemaLabel}${section.letter}`) return sectionScore(section, skills).wScore;
      }
      return '';
    });
  }, [myEvalPlayers, search, sortCol, sortDir]);

  const [helpSchema, setHelpSchema] = useState<SchemaType | null>(null);

  if (myEvalPlayers.length === 0) {
    return (
      <div className="rounded-lg border p-10 text-center mt-4"
        style={{ background: '#243324', borderColor: 'rgba(200,168,75,0.15)' }}>
        <p className="text-lg font-bold mb-1"
          style={{ color: '#f5f0e8', fontFamily: 'Barlow Condensed, sans-serif' }}>
          No evaluations yet
        </p>
        <p className="text-sm" style={{ color: 'rgba(245,240,232,0.45)' }}>
          Rate a player first to see detailed breakdowns here.
        </p>
      </div>
    );
  }

  // Group sections by schema for spanning header
  const schemaGroups = (Object.entries(SCHEMAS) as [SchemaType, (typeof SCHEMAS)[SchemaType]][]).map(
    ([schemaName, def]) => ({
      schemaName,
      schemaLabel: schemaName === 'Batsman' ? 'BAT' : schemaName === 'Fast Bowler' ? 'FB' : 'SB',
      sections: def.sections,
    })
  );

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <TableSearch value={search} onChange={setSearch} />
        <span className="text-xs flex-1" style={{ color: 'rgba(245,240,232,0.4)', fontFamily: 'Barlow Condensed, sans-serif' }}>
          {displayRows.length} of {myEvalPlayers.length} evaluated · click row to edit
        </span>
        <button onClick={() => exportToCSV(players)} style={EXPORT_BTN_STYLE} className="transition-opacity hover:opacity-80">
          {EXPORT_ICON} Export CSV
        </button>
      </div>

      <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(200,168,75,0.15)' }}>
        <div className="overflow-x-auto">
          <table className="text-xs" style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
            <thead>
              {/* Schema group row */}
              <tr style={{ background: '#162614', borderBottom: '1px solid rgba(192,57,43,0.2)' }}>
                <th colSpan={3} style={{ padding: 0 }} />
                {schemaGroups.map(({ schemaName, schemaLabel, sections }) => (
                  <th
                    key={schemaName}
                    colSpan={sections.length}
                    className="px-3 py-1.5 text-center text-[0.6rem] font-bold uppercase tracking-widest"
                    style={{
                      fontFamily: 'Barlow Condensed, sans-serif',
                      color: '#fff',
                      background: SCHEMA_COLORS[schemaName],
                      letterSpacing: '0.12em',
                      borderLeft: '2px solid rgba(0,0,0,0.2)',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      {schemaLabel} — {schemaName}
                      <button
                        onClick={(e) => { e.stopPropagation(); setHelpSchema(schemaName); }}
                        title={`View ${schemaName} scoring guide`}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center' }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
                        </svg>
                      </button>
                    </span>
                  </th>
                ))}
                <th colSpan={2} style={{ padding: 0 }} />
              </tr>

              {/* Column headers */}
              <tr style={TR_HEAD}>
                {(['Player', 'Batch', 'Category'] as string[]).map((h) => (
                  <SortTh key={h} label={h} col={h} sortCol={sortCol} sortDir={sortDir} onSort={toggleSort}
                    className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-widest whitespace-nowrap"
                    style={{ ...TH_STYLE, minWidth: h === 'Player' ? '130px' : '70px' }} />
                ))}
                {schemaGroups.map(({ schemaName, schemaLabel, sections }) =>
                  sections.map((sec) => (
                    <SortTh
                      key={`${schemaName}-${sec.letter}`}
                      label={`${schemaLabel}${sec.letter}`}
                      col={`${schemaLabel}${sec.letter}`}
                      sortCol={sortCol} sortDir={sortDir} onSort={toggleSort}
                      title={sec.name}
                      className="px-3 py-2.5 text-center text-xs font-bold uppercase tracking-widest whitespace-nowrap"
                      style={{
                        fontFamily: 'Barlow Condensed, sans-serif',
                        color: SCHEMA_COLORS[schemaName],
                        minWidth: '60px',
                        borderLeft: sec.letter === 'A' ? '2px solid rgba(0,0,0,0.15)' : undefined,
                      }}
                    />
                  ))
                )}
                {(['Remarks', 'Date'] as string[]).map((h) => (
                  <SortTh key={h} label={h} col={h} sortCol={sortCol} sortDir={sortDir} onSort={toggleSort}
                    className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-widest whitespace-nowrap"
                    style={{ ...TH_STYLE, minWidth: h === 'Remarks' ? '180px' : '80px' }} />
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((p, i) => {
                const skills = p.myEval!.evaluation.skills;
                return (
                  <tr
                    key={p.rowIndex}
                    onClick={() => onRowClick(p)}
                    className="cursor-pointer transition-colors"
                    style={{ background: i % 2 === 0 ? '#1a2a1a' : '#1d2e1e', borderBottom: '1px solid rgba(200,168,75,0.06)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(192,57,43,0.1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? '#1a2a1a' : '#1d2e1e')}
                  >
                    <td className="px-3 py-2.5">
                      <span className="font-bold whitespace-nowrap" style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#f5f0e8' }}>
                        {p.name}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span style={{ color: 'rgba(245,240,232,0.45)', fontFamily: 'Barlow Condensed, sans-serif' }}>{p.batch || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="whitespace-nowrap" style={{ color: 'rgba(245,240,232,0.65)', fontFamily: 'Barlow Condensed, sans-serif' }}>{p.category || '—'}</span>
                    </td>
                    {schemaGroups.map(({ schemaName, sections }) =>
                      sections.map((sec) => {
                        const { wScore, maxW } = sectionScore(sec, skills);
                        const filled = wScore > 0;
                        return (
                          <td
                            key={`${schemaName}-${sec.letter}`}
                            className="px-3 py-2.5 text-center"
                            style={{ borderLeft: sec.letter === 'A' ? '2px solid rgba(0,0,0,0.1)' : undefined }}
                          >
                            {filled ? (
                              <span
                                className="font-bold"
                                style={{ fontFamily: 'Barlow Condensed, sans-serif', color: SCHEMA_COLORS[schemaName] }}
                                title={`${sec.name}: ${wScore}/${maxW}`}
                              >
                                {wScore}/{maxW}
                              </span>
                            ) : (
                              <span style={{ color: 'rgba(245,240,232,0.15)' }}>—</span>
                            )}
                          </td>
                        );
                      })
                    )}
                    <td className="px-3 py-2.5 max-w-[200px]">
                      <span className="line-clamp-2" style={{ color: 'rgba(245,240,232,0.5)' }}>
                        {p.myEval!.remarks || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span style={{ color: 'rgba(245,240,232,0.3)', fontFamily: 'Barlow Condensed, sans-serif' }}>
                        {p.myEval!.savedAt ? new Date(p.myEval!.savedAt).toLocaleDateString() : '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {helpSchema && <SchemaHelpModal schemaName={helpSchema} onClose={() => setHelpSchema(null)} />}
    </div>
  );
}

type SkillDetailRow = {
  player: ScoutPlayer;
  academy: string;
  schemaName: SchemaType;
  schemaLabel: string;
  sectionLetter: string;
  sectionName: string;
  skillName: string;
  skillDesc: string;
  weight: number;
  score: number;
  note: string;
  remarks: string;
};

function exportMySkillDetailsToCSV(rows: SkillDetailRow[]) {
  const data = rows.map((r) => ({
    Player: r.player.name,
    Batch: r.player.batch || '',
    Category: r.player.category || '',
    Academy: r.academy,
    Schema: r.schemaName,
    Section: `${r.schemaLabel}${r.sectionLetter}: ${r.sectionName}`,
    Skill: r.skillName,
    Weight: r.weight,
    Score: r.score > 0 ? r.score : '',
    Notes: r.note,
    'Overall Comment': r.remarks,
  }));
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `my-skill-details-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function MySkillDetailsTable({
  players,
  onRowClick,
}: {
  players: ScoutPlayer[];
  onRowClick: (p: ScoutPlayer) => void;
}) {
  const { search, setSearch, sortCol, sortDir, toggleSort } = useSortSearch();

  const allRows = useMemo((): SkillDetailRow[] => {
    const result: SkillDetailRow[] = [];
    for (const player of players) {
      if (!player.myEval) continue;
      const { skills, notes } = player.myEval.evaluation;
      const remarks = player.myEval.remarks || '';
      const academy = player.extraInfo?.['Academy'] || '';
      for (const [schemaName, def] of Object.entries(SCHEMAS) as [SchemaType, typeof SCHEMAS[SchemaType]][]) {
        const schemaLabel = schemaName === 'Batsman' ? 'BAT' : schemaName === 'Fast Bowler' ? 'FB' : 'SB';
        for (const sec of def.sections) {
          for (const sk of sec.skills) {
            const score = skills[sk.name] || 0;
            const note = notes[sk.name] || '';
            if (score === 0 && !note) continue;
            result.push({
              player, academy, schemaName, schemaLabel,
              sectionLetter: sec.letter, sectionName: sec.name,
              skillName: sk.name, skillDesc: sk.desc, weight: sk.weight,
              score, note, remarks,
            });
          }
        }
      }
    }
    return result;
  }, [players]);

  const displayRows = useMemo(() => {
    const q = search.toLowerCase();
    const base = q
      ? allRows.filter((r) =>
          r.player.name.toLowerCase().includes(q) ||
          (r.player.batch || '').toLowerCase().includes(q) ||
          (r.player.category || '').toLowerCase().includes(q) ||
          r.skillName.toLowerCase().includes(q) ||
          r.sectionName.toLowerCase().includes(q) ||
          r.note.toLowerCase().includes(q) ||
          r.remarks.toLowerCase().includes(q) ||
          r.academy.toLowerCase().includes(q)
        )
      : allRows;
    return applySort(base, sortCol, sortDir, (r, col) => {
      if (col === 'Player') return r.player.name;
      if (col === 'Batch') return r.player.batch || '';
      if (col === 'Category') return r.player.category || '';
      if (col === 'Academy') return r.academy;
      if (col === 'Schema') return r.schemaName;
      if (col === 'Section') return `${r.schemaLabel}${r.sectionLetter}`;
      if (col === 'Skill') return r.skillName;
      if (col === 'Wt') return r.weight;
      if (col === 'Score') return r.score;
      if (col === 'Notes') return r.note;
      if (col === 'Overall Comment') return r.remarks;
      return '';
    });
  }, [allRows, search, sortCol, sortDir]);

  if (allRows.length === 0) {
    return (
      <div className="rounded-lg border p-10 text-center mt-4"
        style={{ background: '#243324', borderColor: 'rgba(200,168,75,0.15)' }}>
        <p className="text-lg font-bold mb-1" style={{ color: '#f5f0e8', fontFamily: 'Barlow Condensed, sans-serif' }}>
          No skill entries yet
        </p>
        <p className="text-sm" style={{ color: 'rgba(245,240,232,0.45)' }}>
          Rate a player and fill in individual skills to see them here.
        </p>
      </div>
    );
  }

  const cols = ['Player', 'Batch', 'Category', 'Academy', 'Schema', 'Section', 'Skill', 'Wt', 'Score', 'Notes', 'Overall Comment'];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <TableSearch value={search} onChange={setSearch} />
        <span className="text-xs flex-1" style={{ color: 'rgba(245,240,232,0.4)', fontFamily: 'Barlow Condensed, sans-serif' }}>
          {displayRows.length} of {allRows.length} skill entries · click row to open player
        </span>
        <button onClick={() => exportMySkillDetailsToCSV(allRows)} style={EXPORT_BTN_STYLE} className="transition-opacity hover:opacity-80">
          {EXPORT_ICON} Export CSV
        </button>
      </div>

      <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(200,168,75,0.15)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={TR_HEAD}>
                {cols.map((h) => (
                  <SortTh key={h} label={h} col={h} sortCol={sortCol} sortDir={sortDir} onSort={toggleSort}
                    className={TH_BASE}
                    style={{ ...TH_STYLE, ...(h === 'Wt' ? { textAlign: 'center' } : {}), ...(h === 'Score' ? { textAlign: 'center' } : {}) }} />
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r, i) => {
                const color = SCHEMA_COLORS[r.schemaName];
                return (
                  <tr
                    key={`${r.player.rowIndex}-${r.schemaName}-${r.sectionLetter}-${r.skillName}-${i}`}
                    onClick={() => onRowClick(r.player)}
                    className="cursor-pointer"
                    style={{ background: i % 2 === 0 ? '#1a2a1a' : '#1d2e1e', borderBottom: '1px solid rgba(200,168,75,0.06)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(192,57,43,0.1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? '#1a2a1a' : '#1d2e1e')}
                  >
                    {/* Player */}
                    <td className="px-4 py-2">
                      <span className="font-bold whitespace-nowrap" style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#f5f0e8' }}>
                        {r.player.name}
                      </span>
                    </td>
                    {/* Batch */}
                    <td className="px-4 py-2">
                      <span style={{ color: 'rgba(245,240,232,0.45)', fontFamily: 'Barlow Condensed, sans-serif' }}>{r.player.batch || '—'}</span>
                    </td>
                    {/* Category */}
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span style={{ color: 'rgba(245,240,232,0.6)', fontFamily: 'Barlow Condensed, sans-serif' }}>{r.player.category || '—'}</span>
                    </td>
                    {/* Academy */}
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span style={{ color: 'rgba(245,240,232,0.55)', fontFamily: 'Barlow Condensed, sans-serif' }}>{r.academy || <span style={{ color: 'rgba(245,240,232,0.15)' }}>—</span>}</span>
                    </td>
                    {/* Schema badge */}
                    <td className="px-4 py-2">
                      <span className="font-bold text-[10px] px-1.5 py-0.5 rounded" style={{ background: color, color: '#fff', fontFamily: 'Barlow Condensed, sans-serif' }}>
                        {r.schemaLabel}
                      </span>
                    </td>
                    {/* Section */}
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="font-bold" style={{ color, fontFamily: 'Barlow Condensed, sans-serif' }}>
                        {r.schemaLabel}{r.sectionLetter}
                      </span>
                      <span className="ml-1.5" style={{ color: 'rgba(245,240,232,0.38)', fontFamily: 'Barlow Condensed, sans-serif' }}>
                        {r.sectionName}
                      </span>
                    </td>
                    {/* Skill */}
                    <td className="px-4 py-2">
                      <span style={{ color: '#f5f0e8', fontFamily: 'Barlow Condensed, sans-serif' }} title={r.skillDesc}>
                        {r.skillName}
                      </span>
                    </td>
                    {/* Weight */}
                    <td className="px-4 py-2 text-center">
                      <span className="text-[10px] font-bold px-1.5 py-px rounded" style={{ background: 'rgba(200,168,75,0.1)', color: 'rgba(200,168,75,0.6)', fontFamily: 'Barlow Condensed, sans-serif' }}>
                        ×{r.weight}
                      </span>
                    </td>
                    {/* Score — stars */}
                    <td className="px-4 py-2 text-center whitespace-nowrap">
                      {r.score > 0 ? (
                        <span>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <span key={n} style={{ color: n <= r.score ? '#c8a84b' : 'rgba(245,240,232,0.12)', fontSize: '0.9rem', lineHeight: 1 }}>★</span>
                          ))}
                          <span className="ml-1.5" style={{ color: 'rgba(245,240,232,0.3)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '0.7rem' }}>
                            {r.score}/5
                          </span>
                        </span>
                      ) : (
                        <span style={{ color: 'rgba(245,240,232,0.15)' }}>—</span>
                      )}
                    </td>
                    {/* Notes */}
                    <td className="px-4 py-2" style={{ maxWidth: '300px' }}>
                      {r.note ? (
                        <span style={{ color: 'rgba(245,240,232,0.7)', fontFamily: 'Barlow, sans-serif', fontStyle: 'italic' }}>
                          "{r.note}"
                        </span>
                      ) : (
                        <span style={{ color: 'rgba(245,240,232,0.15)' }}>—</span>
                      )}
                    </td>
                    {/* Overall Comment */}
                    <td className="px-4 py-2" style={{ maxWidth: '320px' }}>
                      {r.remarks ? (
                        <span style={{ color: 'rgba(245,240,232,0.6)', fontFamily: 'Barlow, sans-serif', fontStyle: 'italic' }}>
                          "{r.remarks}"
                        </span>
                      ) : (
                        <span style={{ color: 'rgba(245,240,232,0.15)' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

type YoyoFilterKey = 'all' | 'green' | 'amber' | 'red' | 'grey';

const YOYO_FILTERS: { key: YoyoFilterKey; label: string; bg: string; text: string; activeBg: string }[] = [
  { key: 'all',   label: 'All',   bg: 'rgba(245,240,232,0.08)', text: 'rgba(245,240,232,0.5)',  activeBg: 'rgba(245,240,232,0.18)' },
  { key: 'green', label: 'Green', bg: 'rgba(27,94,32,0.25)',    text: '#a5d6a7',                activeBg: '#1b5e20' },
  { key: 'amber', label: 'Amber', bg: 'rgba(127,63,0,0.25)',    text: '#ffcc80',                activeBg: '#7f3f00' },
  { key: 'red',   label: 'Red',   bg: 'rgba(127,31,31,0.25)',   text: '#ef9a9a',                activeBg: '#7f1f1f' },
  { key: 'grey',  label: 'No Score', bg: 'rgba(0,0,0,0.12)',   text: 'rgba(245,240,232,0.35)', activeBg: 'rgba(0,0,0,0.3)' },
];

function yoyoCategory(coachEvals: ScoutPlayer['coachEvals']): YoyoFilterKey {
  const badge = getYoYoBadge(coachEvals);
  if (!badge) return 'grey';
  if (badge.best >= 15.5) return 'green';
  if (badge.best >= 15.2) return 'amber';
  return 'red';
}

function exportAllFitnessToCSV(rows: { playerName: string; batch: string; category: string; fitness: Record<string, string>; coachName: string }[]) {
  const data = rows.map((r) => {
    const row: Record<string, string> = { Player: r.playerName, Batch: r.batch, Category: r.category };
    FITNESS_FIELDS.forEach((f) => { row[f] = r.fitness[f] || ''; });
    row['Coach'] = r.coachName;
    return row;
  });
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `all-fitness-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function AllFitnessTable({
  players,
  allBatchNames,
  onRowClick,
}: {
  players: ScoutPlayer[];
  allBatchNames: string[];
  onRowClick: (p: ScoutPlayer) => void;
}) {
  const [yoyoFilter, setYoyoFilter] = useState<YoyoFilterKey>('all');

  // Flatten: one row per coach eval that has any fitness data, sorted by batch → player name
  const allRows = useMemo(() => {
    const batchOrder = new Map(allBatchNames.map((b, i) => [b, i]));
    const sorted = [...players].sort((a, b) => {
      const ai = batchOrder.get(a.batch || 'Unassigned') ?? 999;
      const bi = batchOrder.get(b.batch || 'Unassigned') ?? 999;
      return ai !== bi ? ai - bi : a.name.localeCompare(b.name);
    });
    const result: { player: ScoutPlayer; coachName: string; fitness: Record<string, string>; cat: YoyoFilterKey }[] = [];
    for (const player of sorted) {
      const cat = yoyoCategory(player.coachEvals);
      for (const ev of player.coachEvals) {
        if (!FITNESS_FIELDS.some((f) => ev.evaluation.fitness?.[f])) continue;
        result.push({ player, coachName: ev.coachName || ev.coachEmail, fitness: ev.evaluation.fitness || {}, cat });
      }
    }
    return result;
  }, [players, allBatchNames]);

  const filtered = useMemo(
    () => yoyoFilter === 'all' ? allRows : allRows.filter((r) => r.cat === yoyoFilter),
    [allRows, yoyoFilter]
  );

  const { search, setSearch, sortCol, sortDir, toggleSort } = useSortSearch();
  const displayRows = useMemo(() => {
    const q = search.toLowerCase();
    const base = q
      ? filtered.filter((r) =>
          r.player.name.toLowerCase().includes(q) ||
          (r.player.batch || '').toLowerCase().includes(q) ||
          (r.player.category || '').toLowerCase().includes(q) ||
          r.coachName.toLowerCase().includes(q)
        )
      : filtered;
    return applySort(base, sortCol, sortDir, (r, col) => {
      if (col === 'Player') return r.player.name;
      if (col === 'Batch') return r.player.batch || '';
      if (col === 'Category') return r.player.category || '';
      if (col === 'Coach') return r.coachName || '';
      const fVal = r.fitness[col] || '';
      const n = parseFloat(fVal);
      return isNaN(n) ? fVal : n;
    });
  }, [filtered, search, sortCol, sortDir]);

  const exportRows = allRows.map((r) => ({
    playerName: r.player.name,
    batch: r.player.batch || '',
    category: r.player.category || '',
    fitness: r.fitness,
    coachName: r.coachName,
  }));

  // Count per category for filter badges
  const counts = useMemo(() => {
    const c: Record<YoyoFilterKey, number> = { all: allRows.length, green: 0, amber: 0, red: 0, grey: 0 };
    allRows.forEach((r) => { c[r.cat]++; });
    return c;
  }, [allRows]);

  if (allRows.length === 0) {
    return (
      <div className="rounded-lg border p-10 text-center mt-4" style={{ background: '#243324', borderColor: 'rgba(200,168,75,0.15)' }}>
        <p className="text-lg font-bold mb-1" style={{ color: '#f5f0e8', fontFamily: 'Barlow Condensed, sans-serif' }}>No fitness data yet</p>
        <p className="text-sm" style={{ color: 'rgba(245,240,232,0.45)' }}>Open a player and fill in the Fitness Assessment section.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Yo-Yo filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          {YOYO_FILTERS.map((f) => {
            const isActive = yoyoFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setYoyoFilter(f.key)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-all"
                style={{
                  fontFamily: 'Barlow Condensed, sans-serif',
                  background: isActive ? f.activeBg : f.bg,
                  color: isActive ? '#fff' : f.text,
                  border: `1px solid ${isActive ? 'transparent' : 'rgba(245,240,232,0.08)'}`,
                  letterSpacing: '0.07em',
                }}
              >
                {f.label}
                <span className="text-[10px] px-1 py-px rounded-full font-bold"
                  style={{ background: 'rgba(0,0,0,0.2)', color: 'inherit' }}>
                  {counts[f.key]}
                </span>
              </button>
            );
          })}
        </div>

        <TableSearch value={search} onChange={setSearch} />

        {/* Export */}
        <button onClick={() => exportAllFitnessToCSV(exportRows)} style={EXPORT_BTN_STYLE} className="transition-opacity hover:opacity-80">
          {EXPORT_ICON} Export CSV
        </button>
      </div>

      <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(200,168,75,0.15)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={TR_HEAD}>
                {['Player', 'Batch', 'Category', 'Yo-Yo', ...FITNESS_FIELDS.slice(1), 'Coach'].map((h) => (
                  <SortTh key={h} label={h} col={h} sortCol={sortCol} sortDir={sortDir} onSort={toggleSort}
                    className={TH_BASE}
                    style={{ ...TH_STYLE, color: h === 'Yo-Yo' ? '#c8a84b' : 'rgba(245,240,232,0.55)' }} />
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, i) => {
                const badge = getYoYoBadge(row.player.coachEvals);
                const yoyoVal = row.fitness['Yo-Yo'];
                return (
                  <tr
                    key={`${row.player.rowIndex}-${row.coachName}-${i}`}
                    onClick={() => onRowClick(row.player)}
                    className="cursor-pointer transition-colors"
                    style={{ background: i % 2 === 0 ? '#1a2a1a' : '#1d2e1e', borderBottom: '1px solid rgba(200,168,75,0.06)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(192,57,43,0.1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? '#1a2a1a' : '#1d2e1e')}
                  >
                    <td className="px-4 py-2.5">
                      <span className="font-bold whitespace-nowrap" style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#f5f0e8' }}>
                        {row.player.name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs" style={{ color: 'rgba(245,240,232,0.45)', fontFamily: 'Barlow Condensed, sans-serif' }}>
                        {row.player.batch || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs whitespace-nowrap" style={{ color: 'rgba(245,240,232,0.65)', fontFamily: 'Barlow Condensed, sans-serif' }}>
                        {row.player.category || '—'}
                      </span>
                    </td>
                    {/* Yo-Yo — colored */}
                    <td className="px-4 py-2.5">
                      {yoyoVal ? (
                        <span className="font-bold text-xs px-1.5 py-0.5 rounded"
                          style={{ fontFamily: 'Barlow Condensed, sans-serif', background: badge?.bg || 'rgba(0,0,0,0.08)', color: badge?.text || 'rgba(245,240,232,0.3)' }}>
                          {yoyoVal}
                        </span>
                      ) : (
                        <span style={{ color: 'rgba(245,240,232,0.2)' }}>—</span>
                      )}
                    </td>
                    {/* Remaining fitness fields */}
                    {FITNESS_FIELDS.slice(1).map((f) => (
                      <td key={f} className="px-4 py-2.5">
                        <span style={{ color: row.fitness[f] ? 'rgba(245,240,232,0.7)' : 'rgba(245,240,232,0.2)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '0.8rem' }}>
                          {row.fitness[f] || '—'}
                        </span>
                      </td>
                    ))}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="text-xs" style={{ color: 'rgba(245,240,232,0.45)', fontFamily: 'Barlow Condensed, sans-serif' }}>
                        {row.coachName}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function exportAdminEvalsToCSV(rows: { player: ScoutPlayer; ev: CoachEval }[]) {
  const data = rows.map(({ player, ev }) => {
    const row: Record<string, string | number> = {
      Player: player.name,
      Batch: player.batch || '',
      Category: player.category || '',
      Coach: ev.coachName || ev.coachEmail,
    };
    const skills = ev.evaluation.skills;
    ALL_SCHEMA_SECTIONS.forEach(({ schemaLabel, section }) => {
      const { wScore, maxW } = sectionScore(section, skills);
      row[`${schemaLabel} ${section.letter}: ${section.name}`] = wScore;
      row[`${schemaLabel} ${section.letter} Max`] = maxW;
    });
    row['Remarks'] = ev.remarks || '';
    row['Date'] = ev.savedAt ? new Date(ev.savedAt).toLocaleDateString() : '';
    return row;
  });
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `all-coach-evals-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Selection Summary ─────────────────────────────────────────────────

const SELECTION_EXTRA_COLS = ['Primary Skill', 'Batting hand', 'Batting order', 'Bowler arm', 'Bowling type'] as const;

type RagKey = 'all' | 'green' | 'amber' | 'red' | 'grey';

const RAG_FILTERS: { key: RagKey; label: string; dot: string; bg: string; text: string; activeBg: string }[] = [
  { key: 'all',   label: 'All',      dot: 'rgba(245,240,232,0.3)',  bg: 'rgba(245,240,232,0.08)', text: 'rgba(245,240,232,0.5)',  activeBg: 'rgba(245,240,232,0.18)' },
  { key: 'green', label: 'Green',    dot: '#4caf50',                bg: 'rgba(27,94,32,0.25)',    text: '#a5d6a7',                activeBg: '#1b5e20' },
  { key: 'amber', label: 'Amber',    dot: '#ff9800',                bg: 'rgba(127,63,0,0.25)',    text: '#ffcc80',                activeBg: '#7f3f00' },
  { key: 'red',   label: 'Red',      dot: '#ef5350',                bg: 'rgba(127,31,31,0.25)',   text: '#ef9a9a',                activeBg: '#7f1f1f' },
  { key: 'grey',  label: 'Not Rated', dot: 'rgba(245,240,232,0.2)', bg: 'rgba(0,0,0,0.12)',      text: 'rgba(245,240,232,0.35)', activeBg: 'rgba(0,0,0,0.3)' },
];

function ragCategory(player: ScoutPlayer): RagKey {
  const yoyo = maxYoyo(player);
  if (yoyo === null) return 'grey';
  if (yoyo >= 15.5) return 'green';
  if (yoyo >= 15.2) return 'amber';
  return 'red';
}

function ragStyle(key: RagKey): { color: string; bg: string } {
  if (key === 'green') return { color: '#a5d6a7', bg: 'rgba(27,94,32,0.35)' };
  if (key === 'amber') return { color: '#ffcc80', bg: 'rgba(127,63,0,0.35)' };
  if (key === 'red')   return { color: '#ef9a9a', bg: 'rgba(127,31,31,0.35)' };
  return { color: 'rgba(245,240,232,0.3)', bg: 'rgba(0,0,0,0.2)' };
}

function maxYoyo(player: ScoutPlayer): number | null {
  const vals = player.coachEvals
    .map((e) => parseFloat(e.evaluation.fitness?.['Yo-Yo'] || ''))
    .filter((v) => !isNaN(v) && v > 0);
  return vals.length > 0 ? Math.min(...vals) : null;
}

function exportSelectionToCSV(players: ScoutPlayer[]) {
  const data = players.map((p) => {
    const yoyo = maxYoyo(p);
    const rag = ragCategory(p);
    const row: Record<string, string | number> = {
      Player: p.name,
      Batch: p.batch || '',
      Div: p.div || '',
      Category: p.category || '',
    };
    for (const col of SELECTION_EXTRA_COLS) {
      row[col] = p.extraInfo?.[col] || '';
    }
    row['Evals'] = p.coachEvals.length;
    row['Avg %'] = p.aggregatePct || 0;
    row['Yo-Yo'] = yoyo ?? '';
    row['RAG'] = rag === 'grey' ? 'Not Rated' : rag.charAt(0).toUpperCase() + rag.slice(1);
    return row;
  });
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `selection-summary-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function SelectionSummaryTable({
  players,
  allBatchNames,
  onRowClick,
}: {
  players: ScoutPlayer[];
  allBatchNames: string[];
  onRowClick: (p: ScoutPlayer) => void;
}) {
  const [ragFilters, setRagFilters] = useState<Set<RagKey>>(new Set());
  const [catFilters, setCatFilters] = useState<Set<string>>(new Set());

  function toggleRag(key: RagKey) {
    setRagFilters((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleCat(cat: string) {
    setCatFilters((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  const allCategories = useMemo(() => {
    const seen = new Set<string>();
    const cats: string[] = [];
    const batchOrder = new Map(allBatchNames.map((b, i) => [b, i]));
    [...players]
      .sort((a, b) => (batchOrder.get(a.batch) ?? 999) - (batchOrder.get(b.batch) ?? 999))
      .forEach((p) => { if (p.category && !seen.has(p.category)) { seen.add(p.category); cats.push(p.category); } });
    return cats;
  }, [players, allBatchNames]);

  const baseRows = useMemo(() => {
    const batchOrder = new Map(allBatchNames.map((b, i) => [b, i]));
    return [...players]
      .filter((p) => p.name)
      .sort((a, b) => {
        const ai = batchOrder.get(a.batch || '') ?? 999;
        const bi = batchOrder.get(b.batch || '') ?? 999;
        return ai !== bi ? ai - bi : a.name.localeCompare(b.name);
      });
  }, [players, allBatchNames]);

  const ragCounts = useMemo(() => {
    const c: Record<RagKey, number> = { all: baseRows.length, green: 0, amber: 0, red: 0, grey: 0 };
    baseRows.forEach((p) => { c[ragCategory(p)]++; });
    return c;
  }, [baseRows]);

  const filtered = useMemo(() => {
    return baseRows.filter((p) => {
      if (ragFilters.size > 0 && !ragFilters.has(ragCategory(p))) return false;
      if (catFilters.size > 0 && !catFilters.has(p.category)) return false;
      return true;
    });
  }, [baseRows, ragFilters, catFilters]);

  const { search, setSearch, sortCol, sortDir, toggleSort } = useSortSearch();

  const displayRows = useMemo(() => {
    const q = search.toLowerCase();
    const base = q
      ? filtered.filter((p) =>
          p.name.toLowerCase().includes(q) ||
          (p.batch || '').toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q) ||
          (p.div || '').toLowerCase().includes(q) ||
          (p.schema || '').toLowerCase().includes(q)
        )
      : filtered;
    return applySort(base, sortCol, sortDir, (p, col) => {
      if (col === 'Player')    return p.name;
      if (col === 'Batch')     return p.batch || '';
      if (col === 'Div')       return p.div || '';
      if (col === 'Category')  return p.category || '';
      if (col === 'Evals')     return p.coachEvals.length;
      if (col === 'Avg %')     return p.aggregatePct;
      if (col === 'Yo-Yo')     return maxYoyo(p) ?? -1;
      if (col === 'RAG')       return ragCategory(p);
      if ((SELECTION_EXTRA_COLS as readonly string[]).includes(col)) return p.extraInfo?.[col] || '';
      return '';
    });
  }, [filtered, search, sortCol, sortDir]);

  const TH_BASE = 'px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none';

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col gap-3 mb-3">
        {/* RAG filter chips */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(245,240,232,0.35)', fontFamily: 'Barlow Condensed, sans-serif' }}>Status</span>
            {ragFilters.size > 0 && (
              <button onClick={() => setRagFilters(new Set())} className="text-[10px] font-bold uppercase tracking-wider transition-opacity hover:opacity-70" style={{ color: 'rgba(245,240,232,0.35)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif' }}>
                Clear ✕
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {RAG_FILTERS.filter((f) => f.key !== 'all').map((f) => {
              const isActive = ragFilters.has(f.key);
              return (
                <button
                  key={f.key}
                  onClick={() => toggleRag(f.key)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-all"
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    background: isActive ? f.activeBg : f.bg,
                    color: isActive ? '#fff' : f.text,
                    border: `1px solid ${isActive ? 'transparent' : 'rgba(245,240,232,0.08)'}`,
                    letterSpacing: '0.07em',
                  }}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: f.dot }} />
                  {f.label}
                  <span className="opacity-70 text-[10px]">({ragCounts[f.key]})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Category filter chips */}
        {allCategories.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(245,240,232,0.35)', fontFamily: 'Barlow Condensed, sans-serif' }}>Category</span>
              {catFilters.size > 0 && (
                <button onClick={() => setCatFilters(new Set())} className="text-[10px] font-bold uppercase tracking-wider transition-opacity hover:opacity-70" style={{ color: 'rgba(245,240,232,0.35)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif' }}>
                  Clear ✕
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {allCategories.map((cat) => {
                const col = getCategoryColor(cat);
                const isActive = catFilters.has(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCat(cat)}
                    className="px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-all"
                    style={{
                      fontFamily: 'Barlow Condensed, sans-serif',
                      background: isActive ? col.bg : `${col.bg}55`,
                      color: isActive ? col.text : `${col.text}aa`,
                      border: `1px solid ${isActive ? 'transparent' : 'rgba(245,240,232,0.08)'}`,
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Search + Export — full-width row so export is always on-screen */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <TableSearch value={search} onChange={setSearch} />
          </div>
          <button
            onClick={() => exportSelectionToCSV(displayRows)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-75 flex-shrink-0"
            style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              background: 'rgba(200,168,75,0.12)',
              color: '#c8a84b',
              border: '1px solid rgba(200,168,75,0.25)',
              letterSpacing: '0.07em',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary line */}
      <p className="text-xs mb-3" style={{ color: 'rgba(245,240,232,0.35)', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em' }}>
        {displayRows.length} player{displayRows.length !== 1 ? 's' : ''} · click a row to open eval
      </p>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'rgba(245,240,232,0.08)' }}>
        <table className="w-full border-collapse text-sm" style={{ background: '#1a2c1b' }}>
          <thead>
            <tr style={{ background: '#243324', borderBottom: '1px solid rgba(245,240,232,0.1)' }}>
              {(['Player', 'Batch', 'Div', 'Category', ...SELECTION_EXTRA_COLS, 'Evals', 'Avg %', 'Yo-Yo', 'RAG'] as string[]).map((h) => (
                <SortTh key={h} label={h} col={h} sortCol={sortCol} sortDir={sortDir} onSort={toggleSort}
                  className={TH_BASE}
                  style={{
                    ...TH_STYLE,
                    color: h === 'RAG' ? 'rgba(245,240,232,0.4)' : h === 'Yo-Yo' ? '#c8a84b' : 'rgba(245,240,232,0.55)',
                    minWidth: h === 'Player' ? '140px' : h === 'Category' ? '110px' : (SELECTION_EXTRA_COLS as readonly string[]).includes(h) ? '110px' : '60px',
                  }}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-sm" style={{ color: 'rgba(245,240,232,0.35)', fontFamily: 'Barlow Condensed, sans-serif' }}>
                  No players match the selected filters
                </td>
              </tr>
            ) : displayRows.map((p, i) => {
              const rag = ragCategory(p);
              const rs = ragStyle(rag);
              const yoyo = maxYoyo(p);
              const yoyoBadge = yoyo !== null
                ? (yoyo >= 15.5 ? { color: '#a5d6a7', bg: 'rgba(27,94,32,0.35)' }
                  : yoyo >= 15.2 ? { color: '#ffcc80', bg: 'rgba(127,63,0,0.35)' }
                  : { color: '#ef9a9a', bg: 'rgba(127,31,31,0.35)' })
                : null;
              const catCol = p.category ? getCategoryColor(p.category) : null;
              return (
                <tr
                  key={p.rowIndex}
                  onClick={() => onRowClick(p)}
                  className="transition-colors cursor-pointer"
                  style={{
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                    borderBottom: '1px solid rgba(245,240,232,0.05)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(200,168,75,0.07)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)')}
                >
                  {/* Player */}
                  <td className="px-3 py-2 font-bold" style={{ color: '#f5f0e8', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </td>
                  {/* Batch */}
                  <td className="px-3 py-2 text-xs" style={{ color: 'rgba(245,240,232,0.5)', fontFamily: 'Barlow Condensed, sans-serif', whiteSpace: 'nowrap' }}>
                    {p.batch || '—'}
                  </td>
                  {/* Div */}
                  <td className="px-3 py-2">
                    {p.div ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase" style={(() => { const s = getDivStyle(p.div); return s ? { background: s.bg, color: s.text } : { color: 'rgba(245,240,232,0.4)' }; })()}>
                        {p.div}
                      </span>
                    ) : <span style={{ color: 'rgba(245,240,232,0.2)' }}>—</span>}
                  </td>
                  {/* Category */}
                  <td className="px-3 py-2">
                    {catCol ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase" style={{ background: `${catCol.bg}55`, color: catCol.text }}>
                        {p.category}
                      </span>
                    ) : <span style={{ color: 'rgba(245,240,232,0.4)', fontSize: '0.8rem' }}>—</span>}
                  </td>
                  {/* Extra info columns */}
                  {SELECTION_EXTRA_COLS.map((col) => (
                    <td key={col} className="px-3 py-2 text-xs" style={{ color: 'rgba(245,240,232,0.7)', fontFamily: 'Barlow Condensed, sans-serif', whiteSpace: 'nowrap' }}>
                      {p.extraInfo?.[col] || <span style={{ color: 'rgba(245,240,232,0.2)' }}>—</span>}
                    </td>
                  ))}
                  {/* Evals */}
                  <td className="px-3 py-2 text-center">
                    <span className="text-xs font-bold" style={{ color: p.coachEvals.length > 0 ? '#c8a84b' : 'rgba(245,240,232,0.2)', fontFamily: 'Barlow Condensed, sans-serif' }}>
                      {p.coachEvals.length}
                    </span>
                  </td>
                  {/* Avg % */}
                  <td className="px-3 py-2 text-center">
                    {p.coachEvals.length > 0 ? (
                      <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: rs.bg, color: rs.color, fontFamily: 'Barlow Condensed, sans-serif' }}>
                        {p.aggregatePct}%
                      </span>
                    ) : (
                      <span style={{ color: 'rgba(245,240,232,0.2)', fontSize: '0.8rem' }}>—</span>
                    )}
                  </td>
                  {/* Yo-Yo */}
                  <td className="px-3 py-2 text-center">
                    {yoyoBadge ? (
                      <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: yoyoBadge.bg, color: yoyoBadge.color, fontFamily: 'Barlow Condensed, sans-serif' }}>
                        {yoyo}
                      </span>
                    ) : (
                      <span style={{ color: 'rgba(245,240,232,0.2)', fontSize: '0.8rem' }}>—</span>
                    )}
                  </td>
                  {/* RAG dot */}
                  <td className="px-3 py-2 text-center">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: RAG_FILTERS.find((f) => f.key === rag)?.dot }} />
                      <span className="text-[10px] font-bold uppercase hidden md:inline" style={{ color: rs.color, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.07em' }}>
                        {rag === 'grey' ? 'N/R' : rag}
                      </span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AllEvalDetailsTable({
  players,
  onRowClick,
}: {
  players: ScoutPlayer[];
  onRowClick: (p: ScoutPlayer) => void;
}) {
  const { search, setSearch, sortCol, sortDir, toggleSort } = useSortSearch();

  const allRows = useMemo(() => {
    const result: { player: ScoutPlayer; ev: CoachEval }[] = [];
    for (const player of players) {
      for (const ev of player.coachEvals) {
        result.push({ player, ev });
      }
    }
    return result;
  }, [players]);

  const displayRows = useMemo(() => {
    const q = search.toLowerCase();
    const base = q
      ? allRows.filter((r) =>
          r.player.name.toLowerCase().includes(q) ||
          (r.player.batch || '').toLowerCase().includes(q) ||
          (r.player.category || '').toLowerCase().includes(q) ||
          r.ev.coachName.toLowerCase().includes(q)
        )
      : allRows;
    return applySort(base, sortCol, sortDir, (r, col) => {
      if (col === 'Player') return r.player.name;
      if (col === 'Batch') return r.player.batch || '';
      if (col === 'Category') return r.player.category || '';
      if (col === 'Coach') return r.ev.coachName || '';
      if (col === 'Remarks') return r.ev.remarks || '';
      if (col === 'Date') return r.ev.savedAt || '';
      const skills = r.ev.evaluation.skills;
      for (const { schemaLabel, section } of ALL_SCHEMA_SECTIONS) {
        if (col === `${schemaLabel}${section.letter}`) return sectionScore(section, skills).wScore;
      }
      return '';
    });
  }, [allRows, search, sortCol, sortDir]);

  const schemaGroups = (Object.entries(SCHEMAS) as [SchemaType, (typeof SCHEMAS)[SchemaType]][]).map(
    ([schemaName, def]) => ({
      schemaName,
      schemaLabel: schemaName === 'Batsman' ? 'BAT' : schemaName === 'Fast Bowler' ? 'FB' : 'SB',
      sections: def.sections,
    })
  );

  const [helpSchema, setHelpSchema] = useState<SchemaType | null>(null);

  if (allRows.length === 0) {
    return (
      <div className="rounded-lg border p-10 text-center mt-4"
        style={{ background: '#2a1a1a', borderColor: 'rgba(192,57,43,0.2)' }}>
        <p className="text-lg font-bold mb-1" style={{ color: '#f5f0e8', fontFamily: 'Barlow Condensed, sans-serif' }}>
          No evaluations recorded yet
        </p>
        <p className="text-sm" style={{ color: 'rgba(245,240,232,0.45)' }}>
          Coach evaluations will appear here once players have been rated.
        </p>
      </div>
    );
  }

  const uniqueCoaches = new Set(allRows.map((r) => r.ev.coachEmail)).size;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <TableSearch value={search} onChange={setSearch} />
        <span className="text-xs flex-1" style={{ color: 'rgba(245,240,232,0.4)', fontFamily: 'Barlow Condensed, sans-serif' }}>
          {displayRows.length} of {allRows.length} entries · {uniqueCoaches} coach{uniqueCoaches !== 1 ? 'es' : ''}
        </span>
        <button onClick={() => exportAdminEvalsToCSV(allRows)} style={EXPORT_BTN_STYLE} className="transition-opacity hover:opacity-80">
          {EXPORT_ICON} Export CSV
        </button>
      </div>

      <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(192,57,43,0.2)' }}>
        <div className="overflow-x-auto">
          <table className="text-xs" style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
            <thead>
              {/* Schema group row */}
              <tr style={{ background: '#1a1010', borderBottom: '1px solid rgba(192,57,43,0.2)' }}>
                <th colSpan={4} style={{ padding: 0 }} />
                {schemaGroups.map(({ schemaName, schemaLabel, sections }) => (
                  <th
                    key={schemaName}
                    colSpan={sections.length}
                    className="px-3 py-1.5 text-center text-[0.6rem] font-bold uppercase tracking-widest"
                    style={{
                      fontFamily: 'Barlow Condensed, sans-serif',
                      color: '#fff',
                      background: SCHEMA_COLORS[schemaName],
                      letterSpacing: '0.12em',
                      borderLeft: '2px solid rgba(0,0,0,0.2)',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      {schemaLabel} — {schemaName}
                      <button
                        onClick={(e) => { e.stopPropagation(); setHelpSchema(schemaName); }}
                        title={`View ${schemaName} scoring guide`}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center' }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
                        </svg>
                      </button>
                    </span>
                  </th>
                ))}
                <th colSpan={2} style={{ padding: 0 }} />
              </tr>

              {/* Column headers */}
              <tr style={{ background: '#2a1818', borderBottom: '2px solid rgba(192,57,43,0.4)' }}>
                {(['Player', 'Batch', 'Category', 'Coach'] as string[]).map((h) => (
                  <SortTh key={h} label={h} col={h} sortCol={sortCol} sortDir={sortDir} onSort={toggleSort}
                    className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-widest whitespace-nowrap"
                    style={{ ...TH_STYLE, minWidth: h === 'Player' ? '130px' : h === 'Coach' ? '120px' : '70px' }} />
                ))}
                {schemaGroups.map(({ schemaName, schemaLabel, sections }) =>
                  sections.map((sec) => (
                    <SortTh
                      key={`${schemaName}-${sec.letter}`}
                      label={`${schemaLabel}${sec.letter}`}
                      col={`${schemaLabel}${sec.letter}`}
                      sortCol={sortCol} sortDir={sortDir} onSort={toggleSort}
                      title={sec.name}
                      className="px-3 py-2.5 text-center text-xs font-bold uppercase tracking-widest whitespace-nowrap"
                      style={{
                        fontFamily: 'Barlow Condensed, sans-serif',
                        color: SCHEMA_COLORS[schemaName],
                        minWidth: '60px',
                        borderLeft: sec.letter === 'A' ? '2px solid rgba(0,0,0,0.15)' : undefined,
                      }}
                    />
                  ))
                )}
                {(['Remarks', 'Date'] as string[]).map((h) => (
                  <SortTh key={h} label={h} col={h} sortCol={sortCol} sortDir={sortDir} onSort={toggleSort}
                    className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-widest whitespace-nowrap"
                    style={{ ...TH_STYLE, minWidth: h === 'Remarks' ? '180px' : '80px' }} />
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map(({ player, ev }, i) => {
                const skills = ev.evaluation.skills;
                return (
                  <tr
                    key={`${player.rowIndex}-${ev.coachEmail}-${i}`}
                    onClick={() => onRowClick(player)}
                    className="cursor-pointer transition-colors"
                    style={{ background: i % 2 === 0 ? '#1e1212' : '#221515', borderBottom: '1px solid rgba(192,57,43,0.06)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(192,57,43,0.12)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? '#1e1212' : '#221515')}
                  >
                    <td className="px-3 py-2.5">
                      <span className="font-bold whitespace-nowrap" style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#f5f0e8' }}>
                        {player.name}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span style={{ color: 'rgba(245,240,232,0.45)', fontFamily: 'Barlow Condensed, sans-serif' }}>{player.batch || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="whitespace-nowrap" style={{ color: 'rgba(245,240,232,0.65)', fontFamily: 'Barlow Condensed, sans-serif' }}>{player.category || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="font-semibold" style={{ color: '#ef9a9a', fontFamily: 'Barlow Condensed, sans-serif' }}>
                        {ev.coachName || ev.coachEmail}
                      </span>
                    </td>
                    {schemaGroups.map(({ schemaName, sections }) =>
                      sections.map((sec) => {
                        const { wScore, maxW } = sectionScore(sec, skills);
                        const filled = wScore > 0;
                        return (
                          <td
                            key={`${schemaName}-${sec.letter}`}
                            className="px-3 py-2.5 text-center"
                            style={{ borderLeft: sec.letter === 'A' ? '2px solid rgba(0,0,0,0.1)' : undefined }}
                          >
                            {filled ? (
                              <span
                                className="font-bold"
                                style={{ fontFamily: 'Barlow Condensed, sans-serif', color: SCHEMA_COLORS[schemaName] }}
                                title={`${sec.name}: ${wScore}/${maxW}`}
                              >
                                {wScore}/{maxW}
                              </span>
                            ) : (
                              <span style={{ color: 'rgba(245,240,232,0.15)' }}>—</span>
                            )}
                          </td>
                        );
                      })
                    )}
                    <td className="px-3 py-2.5 max-w-[200px]">
                      <span className="line-clamp-2" style={{ color: 'rgba(245,240,232,0.5)' }}>
                        {ev.remarks || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span style={{ color: 'rgba(245,240,232,0.3)', fontFamily: 'Barlow Condensed, sans-serif' }}>
                        {ev.savedAt ? new Date(ev.savedAt).toLocaleDateString() : '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {helpSchema && <SchemaHelpModal schemaName={helpSchema} onClose={() => setHelpSchema(null)} />}
    </div>
  );
}

type AdminSkillDetailRow = SkillDetailRow & { coachName: string; coachEmail: string };

function exportAdminSkillDetailsToCSV(rows: AdminSkillDetailRow[]) {
  const data = rows.map((r) => ({
    Player: r.player.name,
    Batch: r.player.batch || '',
    Div: r.player.div || '',
    Category: r.player.category || '',
    Academy: r.academy,
    'Primary Skill': r.player.extraInfo?.['Primary Skill'] || '',
    'Yo-Yo': maxYoyo(r.player) ?? '',
    Coach: r.coachName,
    Schema: r.schemaName,
    Section: `${r.schemaLabel}${r.sectionLetter}: ${r.sectionName}`,
    Skill: r.skillName,
    Weight: r.weight,
    Score: r.score > 0 ? r.score : '',
    Notes: r.note,
    'Overall Comment': r.remarks,
  }));
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `all-skill-notes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function AdminSkillDetailsTable({
  players,
  onRowClick,
}: {
  players: ScoutPlayer[];
  onRowClick: (p: ScoutPlayer) => void;
}) {
  const { search, setSearch, sortCol, sortDir, toggleSort } = useSortSearch();
  const [coachFilters, setCoachFilters] = useState<Set<string>>(new Set());
  const [yoyoFilter, setYoyoFilter] = useState<YoyoFilterKey>('all');
  const [schemaFilters, setSchemaFilters] = useState<Set<SchemaType>>(new Set());

  function toggleCoach(email: string) {
    setCoachFilters((prev) => {
      const next = new Set(prev);
      next.has(email) ? next.delete(email) : next.add(email);
      return next;
    });
  }
  function toggleSchema(s: SchemaType) {
    setSchemaFilters((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  }

  const allRows = useMemo((): AdminSkillDetailRow[] => {
    const result: AdminSkillDetailRow[] = [];
    for (const player of players) {
      for (const ev of player.coachEvals) {
        const { skills, notes } = ev.evaluation;
        const remarks = ev.remarks || '';
        const academy = player.extraInfo?.['Academy'] || '';
        for (const [schemaName, def] of Object.entries(SCHEMAS) as [SchemaType, typeof SCHEMAS[SchemaType]][]) {
          const schemaLabel = schemaName === 'Batsman' ? 'BAT' : schemaName === 'Fast Bowler' ? 'FB' : 'SB';
          for (const sec of def.sections) {
            for (const sk of sec.skills) {
              const score = skills[sk.name] || 0;
              const note = notes[sk.name] || '';
              if (score === 0 && !note) continue;
              result.push({
                player, academy, schemaName, schemaLabel,
                sectionLetter: sec.letter, sectionName: sec.name,
                skillName: sk.name, skillDesc: sk.desc, weight: sk.weight,
                score, note, remarks,
                coachName: ev.coachName || ev.coachEmail,
                coachEmail: ev.coachEmail,
              });
            }
          }
        }
      }
    }
    return result;
  }, [players]);

  const displayRows = useMemo(() => {
    const q = search.toLowerCase();
    const base = q
      ? allRows.filter((r) =>
          r.player.name.toLowerCase().includes(q) ||
          (r.player.batch || '').toLowerCase().includes(q) ||
          (r.player.category || '').toLowerCase().includes(q) ||
          r.coachName.toLowerCase().includes(q) ||
          r.skillName.toLowerCase().includes(q) ||
          r.sectionName.toLowerCase().includes(q) ||
          r.note.toLowerCase().includes(q) ||
          r.remarks.toLowerCase().includes(q) ||
          r.academy.toLowerCase().includes(q)
        )
      : allRows;
    const coachFiltered = coachFilters.size > 0
      ? base.filter((r) => coachFilters.has(r.coachEmail))
      : base;
    const yoyoFiltered = yoyoFilter === 'all'
      ? coachFiltered
      : coachFiltered.filter((r) => yoyoCategory(r.player.coachEvals) === yoyoFilter);
    const schemaFiltered = schemaFilters.size > 0
      ? yoyoFiltered.filter((r) => schemaFilters.has(r.schemaName))
      : yoyoFiltered;
    return applySort(schemaFiltered, sortCol, sortDir, (r, col) => {
      if (col === 'Player') return r.player.name;
      if (col === 'Batch') return r.player.batch || '';
      if (col === 'Div') return r.player.div || '';
      if (col === 'Category') return r.player.category || '';
      if (col === 'Academy') return r.academy;
      if (col === 'Primary Skill') return r.player.extraInfo?.['Primary Skill'] || '';
      if (col === 'Yo-Yo') return maxYoyo(r.player) ?? -1;
      if (col === 'Coach') return r.coachName;
      if (col === 'Schema') return r.schemaName;
      if (col === 'Section') return `${r.schemaLabel}${r.sectionLetter}`;
      if (col === 'Skill') return r.skillName;
      if (col === 'Wt') return r.weight;
      if (col === 'Score') return r.score;
      if (col === 'Notes') return r.note;
      if (col === 'Overall Comment') return r.remarks;
      return '';
    });
  }, [allRows, search, sortCol, sortDir, coachFilters, yoyoFilter, schemaFilters]);

  const allCoaches = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of allRows) {
      if (!seen.has(r.coachEmail)) seen.set(r.coachEmail, r.coachName);
    }
    return Array.from(seen.entries()).map(([email, name]) => ({ email, name }));
  }, [allRows]);

  if (allRows.length === 0) {
    return (
      <div className="rounded-lg border p-10 text-center mt-4"
        style={{ background: '#2a1a1a', borderColor: 'rgba(192,57,43,0.2)' }}>
        <p className="text-lg font-bold mb-1" style={{ color: '#f5f0e8', fontFamily: 'Barlow Condensed, sans-serif' }}>
          No skill entries recorded yet
        </p>
        <p className="text-sm" style={{ color: 'rgba(245,240,232,0.45)' }}>
          Skill scores and notes will appear here once coaches have rated players.
        </p>
      </div>
    );
  }

  const uniqueCoaches = allCoaches.length;
  const yoyoCounts = useMemo(() => {
    const seen = new Set<number>();
    const c: Record<YoyoFilterKey, number> = { all: 0, green: 0, amber: 0, red: 0, grey: 0 };
    for (const r of allRows) {
      if (seen.has(r.player.rowIndex)) continue;
      seen.add(r.player.rowIndex);
      c[yoyoCategory(r.player.coachEvals)]++;
      c.all++;
    }
    return c;
  }, [allRows]);
  const cols = ['Player', 'Batch', 'Div', 'Category', 'Academy', 'Primary Skill', 'Yo-Yo', 'Coach', 'Schema', 'Section', 'Skill', 'Wt', 'Score', 'Notes', 'Overall Comment'];

  return (
    <div>
      {/* Yo-Yo filter chips */}
      <div className="flex flex-col gap-1.5 mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(245,240,232,0.35)', fontFamily: 'Barlow Condensed, sans-serif' }}>Yo-Yo Status</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {YOYO_FILTERS.map((f) => {
            const isActive = yoyoFilter === f.key;
            return (
              <button key={f.key} onClick={() => setYoyoFilter(f.key)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-all"
                style={{
                  fontFamily: 'Barlow Condensed, sans-serif',
                  background: isActive ? f.activeBg : f.bg,
                  color: isActive ? '#fff' : f.text,
                  border: `1px solid ${isActive ? 'transparent' : 'rgba(245,240,232,0.08)'}`,
                  letterSpacing: '0.07em',
                }}>
                {f.label}
                <span className="opacity-70 text-[10px]">({yoyoCounts[f.key]})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Coach filter chips */}
      {allCoaches.length > 1 && (
        <div className="flex flex-col gap-1.5 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(239,154,154,0.5)', fontFamily: 'Barlow Condensed, sans-serif' }}>Coach</span>
            {coachFilters.size > 0 && (
              <button onClick={() => setCoachFilters(new Set())} className="text-[10px] font-bold uppercase tracking-wider transition-opacity hover:opacity-70" style={{ color: 'rgba(245,240,232,0.35)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif' }}>
                Clear ✕
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {allCoaches.map(({ email, name }) => {
              const isActive = coachFilters.has(email);
              return (
                <button
                  key={email}
                  onClick={() => toggleCoach(email)}
                  className="px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-all"
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    background: isActive ? 'rgba(192,57,43,0.45)' : 'rgba(192,57,43,0.12)',
                    color: isActive ? '#f5f0e8' : '#ef9a9a',
                    border: `1px solid ${isActive ? 'rgba(192,57,43,0.6)' : 'rgba(192,57,43,0.2)'}`,
                    letterSpacing: '0.06em',
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Schema filter chips */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        {(Object.entries(SCHEMA_COLORS) as [SchemaType, string][]).map(([schema, color]) => {
          const isActive = schemaFilters.has(schema);
          const label = schema === 'Batsman' ? 'BAT' : schema === 'Fast Bowler' ? 'FB' : 'SB';
          return (
            <button key={schema} onClick={() => toggleSchema(schema)}
              className="px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-all"
              style={{
                fontFamily: 'Barlow Condensed, sans-serif',
                background: isActive ? `${color}44` : `${color}14`,
                color: isActive ? '#f5f0e8' : `${color}bb`,
                border: `1px solid ${isActive ? `${color}99` : `${color}33`}`,
              }}>
              {label} · {schema}
            </button>
          );
        })}
        {schemaFilters.size > 0 && (
          <button onClick={() => setSchemaFilters(new Set())} className="text-[10px] font-bold uppercase tracking-wider transition-opacity hover:opacity-70" style={{ color: 'rgba(245,240,232,0.35)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif' }}>
            Clear ✕
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <TableSearch value={search} onChange={setSearch} />
        <span className="text-xs flex-1" style={{ color: 'rgba(245,240,232,0.4)', fontFamily: 'Barlow Condensed, sans-serif' }}>
          {displayRows.length} of {allRows.length} skill entries · {uniqueCoaches} coach{uniqueCoaches !== 1 ? 'es' : ''}
        </span>
        <button onClick={() => exportAdminSkillDetailsToCSV(allRows)} style={EXPORT_BTN_STYLE} className="transition-opacity hover:opacity-80">
          {EXPORT_ICON} Export CSV
        </button>
      </div>

      <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(192,57,43,0.2)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#2a1818', borderBottom: '2px solid rgba(192,57,43,0.4)' }}>
                {cols.map((h) => (
                  <SortTh key={h} label={h} col={h} sortCol={sortCol} sortDir={sortDir} onSort={toggleSort}
                    className={TH_BASE}
                    style={{ ...TH_STYLE, ...(h === 'Wt' || h === 'Score' ? { textAlign: 'center' } : {}) }} />
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r, i) => {
                const color = SCHEMA_COLORS[r.schemaName];
                return (
                  <tr
                    key={`${r.player.rowIndex}-${r.coachEmail}-${r.schemaName}-${r.sectionLetter}-${r.skillName}-${i}`}
                    onClick={() => onRowClick(r.player)}
                    className="cursor-pointer"
                    style={{ background: i % 2 === 0 ? '#1e1212' : '#221515', borderBottom: '1px solid rgba(192,57,43,0.06)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(192,57,43,0.12)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? '#1e1212' : '#221515')}
                  >
                    <td className="px-4 py-2">
                      <span className="font-bold whitespace-nowrap" style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#f5f0e8' }}>
                        {r.player.name}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span style={{ color: 'rgba(245,240,232,0.45)', fontFamily: 'Barlow Condensed, sans-serif' }}>{r.player.batch || '—'}</span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {r.player.div ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase" style={(() => { const s = getDivStyle(r.player.div); return s ? { background: s.bg, color: s.text } : { color: 'rgba(245,240,232,0.4)' }; })()}>
                          {r.player.div}
                        </span>
                      ) : <span style={{ color: 'rgba(245,240,232,0.2)' }}>—</span>}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span style={{ color: 'rgba(245,240,232,0.6)', fontFamily: 'Barlow Condensed, sans-serif' }}>{r.player.category || '—'}</span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span style={{ color: 'rgba(245,240,232,0.55)', fontFamily: 'Barlow Condensed, sans-serif' }}>{r.academy || <span style={{ color: 'rgba(245,240,232,0.15)' }}>—</span>}</span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span style={{ color: 'rgba(245,240,232,0.55)', fontFamily: 'Barlow Condensed, sans-serif' }}>{r.player.extraInfo?.['Primary Skill'] || <span style={{ color: 'rgba(245,240,232,0.15)' }}>—</span>}</span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      {(() => { const yoyo = maxYoyo(r.player); if (yoyo === null) return <span style={{ color: 'rgba(245,240,232,0.2)' }}>—</span>; const badge = getYoYoBadge(r.player.coachEvals); return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: badge?.bg ?? 'rgba(0,0,0,0.2)', color: badge?.text ?? 'rgba(245,240,232,0.4)', fontFamily: 'Barlow Condensed, sans-serif' }}>{yoyo}</span>; })()}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="font-semibold" style={{ color: '#ef9a9a', fontFamily: 'Barlow Condensed, sans-serif' }}>
                        {r.coachName}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="font-bold text-[10px] px-1.5 py-0.5 rounded" style={{ background: color, color: '#fff', fontFamily: 'Barlow Condensed, sans-serif' }}>
                        {r.schemaLabel}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="font-bold" style={{ color, fontFamily: 'Barlow Condensed, sans-serif' }}>
                        {r.schemaLabel}{r.sectionLetter}
                      </span>
                      <span className="ml-1.5" style={{ color: 'rgba(245,240,232,0.38)', fontFamily: 'Barlow Condensed, sans-serif' }}>
                        {r.sectionName}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span style={{ color: '#f5f0e8', fontFamily: 'Barlow Condensed, sans-serif' }} title={r.skillDesc}>
                        {r.skillName}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className="text-[10px] font-bold px-1.5 py-px rounded" style={{ background: 'rgba(200,168,75,0.1)', color: 'rgba(200,168,75,0.6)', fontFamily: 'Barlow Condensed, sans-serif' }}>
                        ×{r.weight}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center whitespace-nowrap">
                      {r.score > 0 ? (
                        <span>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <span key={n} style={{ color: n <= r.score ? '#c8a84b' : 'rgba(245,240,232,0.12)', fontSize: '0.9rem', lineHeight: 1 }}>★</span>
                          ))}
                          <span className="ml-1.5" style={{ color: 'rgba(245,240,232,0.3)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '0.7rem' }}>
                            {r.score}/5
                          </span>
                        </span>
                      ) : (
                        <span style={{ color: 'rgba(245,240,232,0.15)' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-2" style={{ maxWidth: '300px' }}>
                      {r.note ? (
                        <span style={{ color: 'rgba(245,240,232,0.7)', fontFamily: 'Barlow, sans-serif', fontStyle: 'italic' }}>
                          "{r.note}"
                        </span>
                      ) : (
                        <span style={{ color: 'rgba(245,240,232,0.15)' }}>—</span>
                      )}
                    </td>
                    {/* Overall Comment */}
                    <td className="px-4 py-2" style={{ maxWidth: '320px' }}>
                      {r.remarks ? (
                        <span style={{ color: 'rgba(245,240,232,0.6)', fontFamily: 'Barlow, sans-serif', fontStyle: 'italic' }}>
                          "{r.remarks}"
                        </span>
                      ) : (
                        <span style={{ color: 'rgba(245,240,232,0.15)' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Admin Aggregated Skill Averages ───────────────────────────────────

type AggSkillRow = {
  player: ScoutPlayer;
  academy: string;
  schemaName: SchemaType;
  schemaLabel: string;
  sectionLetter: string;
  sectionName: string;
  sectionPct: number;
  sectionRatedSkills: number;
  skillName: string;
  skillDesc: string;
  weight: number;
  avgScore: number;
  coachCount: number;
  totalCoaches: number;
  commentCount: number;
  overallComments: string;
};

function pctColor(pct: number): { bg: string; color: string } {
  if (pct >= 70) return { bg: 'rgba(27,94,32,0.35)', color: '#a5d6a7' };
  if (pct >= 50) return { bg: 'rgba(127,63,0,0.35)', color: '#ffcc80' };
  return { bg: 'rgba(127,31,31,0.35)', color: '#ef9a9a' };
}

function exportAggSkillsToCSV(rows: AggSkillRow[]) {
  const data = rows.map((r) => ({
    Player: r.player.name,
    Batch: r.player.batch || '',
    Div: r.player.div || '',
    Category: r.player.category || '',
    Academy: r.academy,
    'Yo-Yo': maxYoyo(r.player) ?? '',
    Schema: r.schemaName,
    Section: `${r.schemaLabel}${r.sectionLetter}: ${r.sectionName}`,
    'Sec %': r.sectionPct,
    Skill: r.skillName,
    Weight: r.weight,
    'Avg Score': r.avgScore > 0 ? r.avgScore.toFixed(2) : '',
    'Coaches Rated': r.coachCount > 0 ? `${r.coachCount}/${r.totalCoaches}` : '',
    'Comments': r.commentCount > 0 ? `${r.commentCount} coach${r.commentCount !== 1 ? 'es' : ''}: ${r.overallComments}` : '',
  }));
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `skill-averages-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function AdminAggSkillTable({
  players,
  onRowClick,
}: {
  players: ScoutPlayer[];
  onRowClick: (p: ScoutPlayer) => void;
}) {
  const [coachFilters, setCoachFilters] = useState<Set<string>>(new Set());
  const [yoyoFilter, setYoyoFilter] = useState<YoyoFilterKey>('all');
  const [schemaFilters, setSchemaFilters] = useState<Set<SchemaType>>(new Set());
  const { search, setSearch, sortCol, sortDir, toggleSort } = useSortSearch();

  function toggleCoach(email: string) {
    setCoachFilters((prev) => { const n = new Set(prev); n.has(email) ? n.delete(email) : n.add(email); return n; });
  }
  function toggleSchema(s: SchemaType) {
    setSchemaFilters((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  }

  // All coaches (for filter chips — from all evals regardless of filter)
  const allCoaches = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of players) {
      for (const ev of p.coachEvals) {
        if (!seen.has(ev.coachEmail)) seen.set(ev.coachEmail, ev.coachName || ev.coachEmail);
      }
    }
    return Array.from(seen.entries()).map(([email, name]) => ({ email, name }));
  }, [players]);

  const allRows = useMemo((): AggSkillRow[] => {
    const result: AggSkillRow[] = [];
    for (const player of players) {
      const evalsToUse = coachFilters.size > 0
        ? player.coachEvals.filter((e) => coachFilters.has(e.coachEmail))
        : player.coachEvals;
      if (evalsToUse.length === 0) continue;

      const academy = player.extraInfo?.['Academy'] || '';
      const totalCoaches = evalsToUse.length;
      const remarks = evalsToUse.map((e) => (e.remarks || '').trim()).filter(Boolean);
      const commentCount = remarks.length;
      const overallComments = remarks.join(' · ');

      for (const [schemaName, def] of Object.entries(SCHEMAS) as [SchemaType, SectionDef extends never ? never : { sections: SectionDef[] }][]) {
        const sd = def as { sections: SectionDef[] };
        const schemaLabel = schemaName === 'Batsman' ? 'BAT' : schemaName === 'Fast Bowler' ? 'FB' : 'SB';

        for (const sec of sd.sections) {
          // per-skill averages (rated only)
          const skillData = new Map<string, { avgScore: number; coachCount: number }>();
          for (const sk of sec.skills) {
            const scores = evalsToUse
              .map((e) => e.evaluation.skills?.[sk.name] || 0)
              .filter((s) => s > 0);
            if (scores.length > 0) {
              skillData.set(sk.name, {
                avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
                coachCount: scores.length,
              });
            }
          }
          if (skillData.size === 0) continue;

          // section score — weighted by rated skills only
          let wScore = 0, maxW = 0;
          for (const sk of sec.skills) {
            const d = skillData.get(sk.name);
            if (d) { wScore += sk.weight * d.avgScore; maxW += sk.weight; }
          }
          const sectionPct = maxW > 0 ? Math.round((wScore / (maxW * 5)) * 100) : 0;

          for (const sk of sec.skills) {
            const d = skillData.get(sk.name);
            if (!d) continue; // skip unrated skills
            result.push({
              player, academy, schemaName, schemaLabel,
              sectionLetter: sec.letter, sectionName: sec.name,
              sectionPct, sectionRatedSkills: skillData.size,
              skillName: sk.name, skillDesc: sk.desc, weight: sk.weight,
              avgScore: d.avgScore, coachCount: d.coachCount,
              totalCoaches, commentCount, overallComments,
            });
          }
        }
      }
    }
    return result;
  }, [players, coachFilters]);

  const yoyoCounts = useMemo(() => {
    const seen = new Map<number, ScoutPlayer>();
    for (const r of allRows) seen.set(r.player.rowIndex, r.player);
    const counts: Record<YoyoFilterKey, number> = { all: seen.size, green: 0, amber: 0, red: 0, grey: 0 };
    for (const p of seen.values()) counts[yoyoCategory(p.coachEvals)]++;
    return counts;
  }, [allRows]);

  const displayRows = useMemo(() => {
    const q = search.toLowerCase();
    const afterSearch = q
      ? allRows.filter((r) =>
          r.player.name.toLowerCase().includes(q) ||
          (r.player.batch || '').toLowerCase().includes(q) ||
          (r.player.div || '').toLowerCase().includes(q) ||
          (r.player.category || '').toLowerCase().includes(q) ||
          r.academy.toLowerCase().includes(q) ||
          r.skillName.toLowerCase().includes(q) ||
          r.sectionName.toLowerCase().includes(q) ||
          r.overallComments.toLowerCase().includes(q)
        )
      : allRows;
    const afterYoyo = yoyoFilter === 'all' ? afterSearch : afterSearch.filter((r) => yoyoCategory(r.player.coachEvals) === yoyoFilter);
    const afterSchema = schemaFilters.size > 0 ? afterYoyo.filter((r) => schemaFilters.has(r.schemaName)) : afterYoyo;
    return applySort(afterSchema, sortCol, sortDir, (r, col) => {
      if (col === 'Player')    return r.player.name;
      if (col === 'Batch')     return r.player.batch || '';
      if (col === 'Div')       return r.player.div || '';
      if (col === 'Category')  return r.player.category || '';
      if (col === 'Academy')   return r.academy;
      if (col === 'Yo-Yo')     return maxYoyo(r.player) ?? -1;
      if (col === 'Schema')    return r.schemaName;
      if (col === 'Section')   return `${r.schemaLabel}${r.sectionLetter}`;
      if (col === 'Sec %')     return r.sectionPct;
      if (col === 'Skill')     return r.skillName;
      if (col === 'Wt')        return r.weight;
      if (col === 'Avg Score') return r.avgScore;
      if (col === 'Rated By')  return r.coachCount;
      if (col === 'Comments')  return r.commentCount;
      return '';
    });
  }, [allRows, search, yoyoFilter, schemaFilters, sortCol, sortDir]);

  if (allRows.length === 0) {
    return (
      <div className="rounded-lg border p-10 text-center mt-4"
        style={{ background: '#2a1a1a', borderColor: 'rgba(192,57,43,0.2)' }}>
        <p className="text-lg font-bold mb-1" style={{ color: '#f5f0e8', fontFamily: 'Barlow Condensed, sans-serif' }}>No data yet</p>
        <p className="text-sm" style={{ color: 'rgba(245,240,232,0.45)' }}>Skill averages will appear once coaches have rated players.</p>
      </div>
    );
  }

  const TH_BASE = 'px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none';
  const cols = ['Player', 'Batch', 'Div', 'Category', 'Academy', 'Schema', 'Section', 'Sec %', 'Skill', 'Wt', 'Avg Score', 'Rated By', 'Yo-Yo', 'Comments'];

  return (
    <div>
      {/* Coach filter */}
      {allCoaches.length > 1 && (
        <div className="flex flex-col gap-1.5 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(239,154,154,0.5)', fontFamily: 'Barlow Condensed, sans-serif' }}>
              Coaches included in averages
            </span>
            {coachFilters.size > 0 && (
              <button onClick={() => setCoachFilters(new Set())} className="text-[10px] font-bold uppercase tracking-wider transition-opacity hover:opacity-70" style={{ color: 'rgba(245,240,232,0.35)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif' }}>
                Clear ✕
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {allCoaches.map(({ email, name }) => {
              const isActive = coachFilters.has(email);
              return (
                <button key={email} onClick={() => toggleCoach(email)}
                  className="px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-all"
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    background: isActive ? 'rgba(192,57,43,0.45)' : 'rgba(192,57,43,0.12)',
                    color: isActive ? '#f5f0e8' : '#ef9a9a',
                    border: `1px solid ${isActive ? 'rgba(192,57,43,0.6)' : 'rgba(192,57,43,0.2)'}`,
                    letterSpacing: '0.06em',
                  }}>
                  {name}
                </button>
              );
            })}
          </div>
          {coachFilters.size > 0 && (
            <p className="text-[10px]" style={{ color: 'rgba(245,240,232,0.3)', fontFamily: 'Barlow Condensed, sans-serif' }}>
              Averages computed from {coachFilters.size} selected coach{coachFilters.size !== 1 ? 'es' : ''} only
            </p>
          )}
        </div>
      )}

      {/* Yo-Yo filter */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        {YOYO_FILTERS.map(({ key, label, bg, text, activeBg }) => {
          const count = yoyoCounts[key];
          const isActive = yoyoFilter === key;
          return (
            <button key={key} onClick={() => setYoyoFilter(key as YoyoFilterKey)}
              className="px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-all"
              style={{
                fontFamily: 'Barlow Condensed, sans-serif',
                background: isActive ? activeBg : bg,
                color: text,
                border: `1px solid ${isActive ? text : 'transparent'}`,
              }}>
              {label} <span style={{ opacity: 0.7 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Schema filter chips */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        {(Object.entries(SCHEMA_COLORS) as [SchemaType, string][]).map(([schema, color]) => {
          const isActive = schemaFilters.has(schema);
          const label = schema === 'Batsman' ? 'BAT' : schema === 'Fast Bowler' ? 'FB' : 'SB';
          return (
            <button key={schema} onClick={() => toggleSchema(schema)}
              className="px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-all"
              style={{
                fontFamily: 'Barlow Condensed, sans-serif',
                background: isActive ? `${color}44` : `${color}14`,
                color: isActive ? '#f5f0e8' : `${color}bb`,
                border: `1px solid ${isActive ? `${color}99` : `${color}33`}`,
              }}>
              {label} · {schema}
            </button>
          );
        })}
        {schemaFilters.size > 0 && (
          <button onClick={() => setSchemaFilters(new Set())} className="text-[10px] font-bold uppercase tracking-wider transition-opacity hover:opacity-70" style={{ color: 'rgba(245,240,232,0.35)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif' }}>
            Clear ✕
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <TableSearch value={search} onChange={setSearch} />
        <span className="text-xs flex-1" style={{ color: 'rgba(245,240,232,0.4)', fontFamily: 'Barlow Condensed, sans-serif' }}>
          {displayRows.length} skill rows · {new Set(displayRows.map((r) => r.player.rowIndex)).size} players
        </span>
        <button onClick={() => exportAggSkillsToCSV(displayRows)} style={EXPORT_BTN_STYLE} className="transition-opacity hover:opacity-80">
          {EXPORT_ICON} Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(192,57,43,0.2)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#2a1818', borderBottom: '2px solid rgba(192,57,43,0.4)' }}>
                {cols.map((h) => (
                  <SortTh key={h} label={h} col={h} sortCol={sortCol} sortDir={sortDir} onSort={toggleSort}
                    className={TH_BASE}
                    style={{
                      ...TH_STYLE,
                      textAlign: ['Wt', 'Avg Score', 'Rated By', 'Comments', 'Sec %', 'Yo-Yo'].includes(h) ? 'center' : 'left',
                      color: h === 'Sec %' ? '#c8a84b' : h === 'Yo-Yo' ? '#81c784' : 'rgba(245,240,232,0.55)',
                    }} />
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r, i) => {
                const schColor = SCHEMA_COLORS[r.schemaName];
                const sp = pctColor(r.sectionPct);
                return (
                  <tr key={`${r.player.rowIndex}-${r.schemaName}-${r.sectionLetter}-${r.skillName}-${i}`}
                    onClick={() => onRowClick(r.player)}
                    className="cursor-pointer"
                    style={{ background: i % 2 === 0 ? '#1e1212' : '#221515', borderBottom: '1px solid rgba(192,57,43,0.06)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(192,57,43,0.12)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? '#1e1212' : '#221515')}
                  >
                    {/* Player */}
                    <td className="px-3 py-2">
                      <span className="font-bold whitespace-nowrap" style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#f5f0e8' }}>{r.player.name}</span>
                    </td>
                    {/* Batch */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span style={{ color: 'rgba(245,240,232,0.45)', fontFamily: 'Barlow Condensed, sans-serif' }}>{r.player.batch || '—'}</span>
                    </td>
                    {/* Div */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase" style={(() => { const s = getDivStyle(r.player.div); return s ? { background: s.bg, color: s.text } : { color: 'rgba(245,240,232,0.4)' }; })()}>
                        {r.player.div || '—'}
                      </span>
                    </td>
                    {/* Category */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span style={{ color: 'rgba(245,240,232,0.6)', fontFamily: 'Barlow Condensed, sans-serif' }}>{r.player.category || '—'}</span>
                    </td>
                    {/* Academy */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span style={{ color: 'rgba(245,240,232,0.55)', fontFamily: 'Barlow Condensed, sans-serif' }}>{r.academy || <span style={{ color: 'rgba(245,240,232,0.15)' }}>—</span>}</span>
                    </td>
                    {/* Schema */}
                    <td className="px-3 py-2">
                      <span className="font-bold text-[10px] px-1.5 py-0.5 rounded" style={{ background: schColor, color: '#fff', fontFamily: 'Barlow Condensed, sans-serif' }}>
                        {r.schemaLabel}
                      </span>
                    </td>
                    {/* Section */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="font-bold" style={{ color: schColor, fontFamily: 'Barlow Condensed, sans-serif' }}>{r.schemaLabel}{r.sectionLetter}</span>
                      <span className="ml-1.5" style={{ color: 'rgba(245,240,232,0.38)', fontFamily: 'Barlow Condensed, sans-serif' }}>{r.sectionName}</span>
                    </td>
                    {/* Sec % */}
                    <td className="px-3 py-2 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: sp.bg, color: sp.color, fontFamily: 'Barlow Condensed, sans-serif' }}>
                        {r.sectionPct}%
                      </span>
                    </td>
                    {/* Skill */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span style={{ color: '#f5f0e8', fontFamily: 'Barlow Condensed, sans-serif' }} title={r.skillDesc}>{r.skillName}</span>
                    </td>
                    {/* Wt */}
                    <td className="px-3 py-2 text-center">
                      <span className="text-[10px] font-bold px-1 py-px rounded" style={{ background: 'rgba(200,168,75,0.1)', color: 'rgba(200,168,75,0.6)', fontFamily: 'Barlow Condensed, sans-serif' }}>×{r.weight}</span>
                    </td>
                    {/* Avg Score */}
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <span>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span key={n} style={{ color: n <= Math.round(r.avgScore) ? '#c8a84b' : 'rgba(245,240,232,0.12)', fontSize: '0.85rem', lineHeight: 1 }}>★</span>
                        ))}
                        <span className="ml-1" style={{ color: 'rgba(245,240,232,0.4)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '0.68rem' }}>
                          {r.avgScore.toFixed(1)}/5
                        </span>
                      </span>
                    </td>
                    {/* Rated By */}
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <span className="text-[11px] font-bold" style={{ color: '#c8a84b', fontFamily: 'Barlow Condensed, sans-serif' }}>
                        {r.coachCount}
                      </span>
                      <span className="text-[10px]" style={{ color: 'rgba(245,240,232,0.3)', fontFamily: 'Barlow Condensed, sans-serif' }}>
                        /{r.totalCoaches}
                      </span>
                    </td>
                    {/* Yo-Yo */}
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      {(() => {
                        const yy = maxYoyo(r.player);
                        if (yy === null) return <span style={{ color: 'rgba(245,240,232,0.2)', fontFamily: 'Barlow Condensed, sans-serif' }}>—</span>;
                        const cat = yoyoCategory(r.player.coachEvals);
                        const clr = cat === 'green' ? '#81c784' : cat === 'amber' ? '#ffb74d' : '#ef9a9a';
                        return <span className="font-bold text-[11px]" style={{ color: clr, fontFamily: 'Barlow Condensed, sans-serif' }}>{yy.toFixed(1)}</span>;
                      })()}
                    </td>
                    {/* Overall Comments */}
                    <td className="px-3 py-2" style={{ maxWidth: '280px' }}>
                      {r.commentCount > 0 ? (
                        <>
                          <span className="text-[10px] font-bold mr-1.5" style={{ color: 'rgba(245,240,232,0.35)', fontFamily: 'Barlow Condensed, sans-serif' }}>
                            {r.commentCount} coach{r.commentCount !== 1 ? 'es' : ''}:
                          </span>
                          <span style={{ color: 'rgba(245,240,232,0.65)', fontFamily: 'Barlow, sans-serif', fontStyle: 'italic' }}>
                            {r.overallComments}
                          </span>
                        </>
                      ) : (
                        <span style={{ color: 'rgba(245,240,232,0.15)' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed bottom-6 left-1/2 z-50 px-5 py-2.5 rounded-lg border-l-4 text-sm font-semibold tracking-wide pointer-events-none"
      style={{
        transform: 'translateX(-50%)',
        background: '#1a0808', color: '#f5f0e8', borderColor: '#c0392b',
        fontFamily: 'Barlow Condensed, sans-serif',
        animation: 'slideUp 0.3s ease', whiteSpace: 'nowrap',
      }}>
      {message}
    </div>
  );
}

// ── NavDropdown ───────────────────────────────────────────────────────

type NavItem = { label: string; mode: string; badge?: number };

function NavDropdown({
  label,
  items,
  activeMode,
  onSelect,
  accentColor = '#c8a84b',
  lockIcon = false,
  align = 'left',
}: {
  label: string;
  items: NavItem[];
  activeMode: string;
  onSelect: (mode: string) => void;
  accentColor?: string;
  lockIcon?: boolean;
  align?: 'left' | 'right';
}) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  // On touch/mobile devices (hover: none), click toggles the menu; on desktop, hover controls it
  const [touchOnly, setTouchOnly] = useState(false);
  useEffect(() => { setTouchOnly(!window.matchMedia('(hover: hover)').matches); }, []);
  const isOpen = touchOnly ? pinned : hovered;
  const hasActive = items.some((i) => i.mode === activeMode);
  const dimColor = `${accentColor}66`;
  const hoverColor = `${accentColor}bb`;

  return (
    <div
      className="relative flex-shrink-0 flex items-stretch"
      onMouseEnter={() => { if (!touchOnly) setHovered(true); }}
      onMouseLeave={() => { if (!touchOnly) setHovered(false); }}
    >
      <button
        className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold uppercase tracking-wider border-b-2"
        onClick={() => { if (touchOnly) setPinned((p) => !p); }}
        style={{
          fontFamily: 'Barlow Condensed, sans-serif',
          color: hasActive ? accentColor : dimColor,
          borderColor: hasActive ? accentColor : 'transparent',
          background: 'none', cursor: 'pointer', letterSpacing: '0.08em',
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = hoverColor; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = hasActive ? accentColor : dimColor; }}
      >
        {lockIcon && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        )}
        {label}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6, marginTop: 1, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', ...(align === 'right' ? { right: 0 } : { left: 0 }), minWidth: 200,
          background: '#1e1010', border: '1px solid rgba(192,57,43,0.28)',
          borderRadius: 8, zIndex: 200, boxShadow: '0 10px 36px rgba(0,0,0,0.65)',
          overflow: 'hidden',
        }}>
          {items.map((item, idx) => {
            const isItemActive = item.mode === activeMode;
            return (
              <button
                key={item.mode}
                onClick={() => { onSelect(item.mode); setPinned(false); setHovered(false); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '10px 16px',
                  background: isItemActive ? `${accentColor}18` : 'transparent',
                  color: isItemActive ? accentColor : 'rgba(245,240,232,0.55)',
                  fontFamily: 'Barlow Condensed, sans-serif', fontSize: 12, fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
                  border: 'none',
                  borderBottom: idx < items.length - 1 ? '1px solid rgba(192,57,43,0.08)' : 'none',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = `${accentColor}12`;
                  if (!isItemActive) el.style.color = 'rgba(245,240,232,0.88)';
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = isItemActive ? `${accentColor}18` : 'transparent';
                  if (!isItemActive) el.style.color = 'rgba(245,240,232,0.55)';
                }}
              >
                <span>{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span style={{
                    background: isItemActive ? `${accentColor}30` : 'rgba(255,255,255,0.08)',
                    color: isItemActive ? accentColor : 'rgba(245,240,232,0.35)',
                    borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700,
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────

export function ScoutBoard({ sheetKey, user }: ScoutBoardProps) {
  const router = useRouter();
  const PINNED_KEY = `scout_pinned_${sheetKey}`;

  const [players, setPlayers] = useState<ScoutPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [activePlayer, setActivePlayer] = useState<ScoutPlayer | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBatch, setActiveBatch] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'board' | 'my-evals' | 'my-eval-details' | 'my-skill-details' | 'all-fitness' | 'selection' | 'team-packages' | 'admin-evals' | 'admin-skill-details' | 'admin-agg-skills' | 'admin-team-packages'>('board');
  const [isAdmin, setIsAdmin] = useState(false);
  const isDemo = sheetKey === 'demo';

  const [pinnedIds, setPinnedIds] = useState<Set<number>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem(`scout_pinned_${sheetKey}`);
      return stored ? new Set<number>(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  useEffect(() => {
    setLoading(true);
    fetch(`/api/scout?sheetKey=${encodeURIComponent(sheetKey)}`)
      .then(async (r) => {
        if (r.status === 403) { setUnauthorized(true); return; }
        const data = await r.json();
        if (data.error) setError(data.error);
        else { setPlayers(data.players || []); setIsAdmin(!!data.isAdmin); }
      })
      .catch(() => setError('Failed to load player data.'))
      .finally(() => setLoading(false));
  }, [sheetKey]);

  // Ordered unique batch names (preserving sheet order)
  const allBatchNames = useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const p of players) {
      const b = p.batch || 'Unassigned';
      if (!seen.has(b)) { seen.add(b); names.push(b); }
    }
    return names;
  }, [players]);

  // Auto-select first batch once data loads
  useEffect(() => {
    if (allBatchNames.length > 0 && !activeBatch) {
      setActiveBatch(allBatchNames[0]);
    }
  }, [allBatchNames, activeBatch]);

  const togglePin = useCallback((rowIndex: number) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      try { localStorage.setItem(PINNED_KEY, JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  }, [PINNED_KEY]);

  const isSearching = searchQuery.trim().length > 0;
  const q = searchQuery.trim().toLowerCase();

  // Pinned: always global across all batches
  const pinnedPlayers = useMemo(
    () => players.filter((p) => pinnedIds.has(p.rowIndex) && (!q || matchesSearch(p, q))),
    [players, pinnedIds, q]
  );

  // Active batch players (or global search results)
  const batchPlayers = useMemo(() => {
    if (isSearching) return players.filter((p) => matchesSearch(p, q));
    if (!activeBatch) return [];
    return players.filter((p) => (p.batch || 'Unassigned') === activeBatch);
  }, [players, isSearching, q, activeBatch]);

  const categoryGroups = useMemo(() => groupByCategory(batchPlayers), [batchPlayers]);

  const handleSave = useCallback(
    async (evaluation: PlayerEvaluation, remarks: string) => {
      if (!activePlayer) return;
      const schema = SCHEMAS[activePlayer.schema as SchemaType];
      if (!schema) return;
      const { weighted, pct } = calcScore(evaluation, schema);
      const { label: ratingLabel } = getRating(pct);

      setSaving(true);
      try {
        const res = await fetch(
          `/api/scout/coach-eval?sheetKey=${encodeURIComponent(sheetKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playerRowIndex: activePlayer.rowIndex,
              evaluation,
              score: weighted,
              pct,
              rating: ratingLabel,
              remarks,
            }),
          }
        );
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Save failed'); }

        const newEval: CoachEval = {
          coachEmail: user.email,
          coachName: user.name,
          evaluation,
          score: weighted,
          pct,
          rating: ratingLabel,
          remarks,
          savedAt: new Date().toISOString(),
        };

        setPlayers((prev) =>
          prev.map((p) => {
            if (p.rowIndex !== activePlayer.rowIndex) return p;
            const updatedEvals = [
              ...p.coachEvals.filter((e) => e.coachEmail !== user.email),
              newEval,
            ];
            const aggregatePct = Math.round(
              updatedEvals.reduce((sum, e) => sum + e.pct, 0) / updatedEvals.length
            );
            return { ...p, coachEvals: updatedEvals, myEval: newEval, aggregatePct, evaluation, remarks };
          })
        );
        setActivePlayer(null);
        setToast(`${activePlayer.name} saved ✓`);
      } catch (e: any) {
        setToast(`Error: ${e.message}`);
      } finally {
        setSaving(false);
      }
    },
    [activePlayer, sheetKey, user.email, user.name]
  );

  const totalEvaluated = players.filter(isEvaluated).length;

  return (
    <>
      <style>{`
        @keyframes slideUp { from { transform: translateX(-50%) translateY(20px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }
        .search-input::placeholder { color: rgba(245,240,232,0.3); }
        .search-input:focus { outline: none; border-color: rgba(192,57,43,0.6); }
        .batch-tabs::-webkit-scrollbar { display: none; }
      `}</style>

      <div style={{ background: '#162614', minHeight: '100vh', fontFamily: 'Barlow, sans-serif' }}>

        {/* ── Sticky header + tab bar ── */}
        <header className="sticky top-0 z-10 border-b-2" style={{ background: '#1d2e1e', borderColor: '#c0392b' }}>

          {/* Top row */}
          <div className="flex items-center gap-3 px-5 md:px-7 py-3">
            {/* Cricket ball */}
            <div className="w-8 h-8 rounded-full flex-shrink-0 relative"
              style={{ background: '#c0392b', boxShadow: 'inset -3px -3px 0 rgba(0,0,0,0.25), 0 0 0 2px rgba(192,57,43,0.3)' }}>
              <span className="absolute" style={{
                top: '50%', left: '8%', width: '84%', height: '1.5px',
                background: 'rgba(255,255,255,0.35)',
                transform: 'translateY(-50%) rotate(-20deg)', borderRadius: '2px',
              }} />
              <span className="absolute" style={{
                top: '50%', left: '8%', width: '84%', height: '1.5px',
                background: 'rgba(255,255,255,0.2)',
                transform: 'translateY(-50%) rotate(20deg)', borderRadius: '2px',
              }} />
            </div>

            <h1 className="text-lg font-extrabold uppercase tracking-wider flex-shrink-0"
              style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#f5f0e8' }}>
              Scout<span style={{ color: '#c0392b' }}>Board</span>
            </h1>

            {/* Search bar */}
            <div className="flex-1 mx-3 md:mx-5 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'rgba(245,240,232,0.35)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="text"
                className="search-input w-full pl-8 pr-8 py-1.5 rounded-md text-sm border transition-colors"
                style={{
                  background: 'rgba(0,0,0,0.25)', color: '#f5f0e8',
                  borderColor: 'rgba(245,240,232,0.15)', fontFamily: 'Barlow, sans-serif',
                }}
                placeholder="Search players…"
                value={searchQuery}
                onChange={(e) => { setViewMode('board'); setSearchQuery(e.target.value); }}
              />
              {searchQuery && (
                <button className="absolute right-2.5 top-1/2 -translate-y-1/2 leading-none"
                  style={{ color: 'rgba(245,240,232,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}
                  onClick={() => setSearchQuery('')}>✕</button>
              )}
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {!loading && players.length > 0 && (
                <span className="text-xs hidden lg:block"
                  style={{ color: 'rgba(245,240,232,0.4)', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                  {totalEvaluated}/{players.length} rated
                </span>
              )}
              {pinnedIds.size > 0 && (
                <span className="text-xs hidden md:block"
                  style={{ color: 'rgba(245,240,232,0.6)', fontFamily: 'Barlow Condensed, sans-serif', whiteSpace: 'nowrap' }}>
                  {pinnedIds.size} pinned
                </span>
              )}
              {user.image && <img src={user.image} alt={user.name} className="w-7 h-7 rounded-full hidden sm:block" />}
              <button onClick={() => router.push('/dashboard')}
                className="text-xs px-2.5 py-1.5 rounded border transition-opacity hover:opacity-80 hidden sm:block"
                style={{
                  fontFamily: 'Barlow Condensed, sans-serif', color: '#f5f0e8',
                  borderColor: 'rgba(245,240,232,0.2)', background: 'transparent',
                  letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700,
                }}>
                Schedule
              </button>
              {!isDemo && (
                <a href="/scout/demo"
                  className="text-xs px-2.5 py-1.5 rounded border transition-opacity hover:opacity-80 hidden sm:block no-underline"
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif', color: '#c8a84b',
                    borderColor: 'rgba(200,168,75,0.4)', background: 'transparent',
                    letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700,
                  }}>
                  Demo
                </a>
              )}
              <button onClick={() => signOut({ callbackUrl: '/login' })}
                className="text-xs px-2.5 py-1.5 rounded transition-opacity hover:opacity-80"
                style={{
                  fontFamily: 'Barlow Condensed, sans-serif', color: 'rgba(245,240,232,0.5)',
                  background: 'transparent', border: 'none',
                  letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700,
                }}>
                Sign out
              </button>
            </div>
          </div>

          {/* Demo mode banner */}
          {isDemo && (
            <div className="flex items-center justify-between px-5 md:px-7 py-1.5"
              style={{ background: 'rgba(200,168,75,0.12)', borderTop: '1px solid rgba(200,168,75,0.3)' }}>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#c8a84b', fontFamily: 'Barlow Condensed, sans-serif' }}>
                ★ Demo Mode — data is illustrative only
              </span>
              <a href="/scout"
                className="text-xs font-bold no-underline transition-opacity hover:opacity-70"
                style={{ color: '#c8a84b', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.06em' }}>
                Exit Demo →
              </a>
            </div>
          )}

          {/* Batch tabs + Reports/Admin menus */}
          {!loading && !error && players.length > 0 && (
            <div className="batch-tabs border-t flex" style={{ borderColor: 'rgba(192,57,43,0.2)' }}>
              {/* Batch tabs — scrollable */}
              <div className="flex overflow-x-auto flex-1" style={{ scrollbarWidth: 'none' }}>
                {allBatchNames.map((name) => {
                  const isActive = viewMode === 'board' && !isSearching && activeBatch === name;
                  return (
                    <button
                      key={name}
                      onClick={() => { setViewMode('board'); setActiveBatch(name); setSearchQuery(''); }}
                      className="flex-shrink-0 px-5 py-2 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors"
                      style={{
                        fontFamily: 'Barlow Condensed, sans-serif',
                        color: isActive ? '#f5f0e8' : 'rgba(245,240,232,0.4)',
                        borderColor: isActive ? '#c0392b' : 'transparent',
                        background: 'none', cursor: 'pointer', letterSpacing: '0.08em',
                      }}
                      onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'rgba(245,240,232,0.75)'; }}
                      onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'rgba(245,240,232,0.4)'; }}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>

              {/* Reports + Admin dropdowns — fixed, not scrolling */}
              <div className="flex items-stretch flex-shrink-0">
                <div className="w-px my-2 flex-shrink-0" style={{ background: 'rgba(245,240,232,0.1)' }} />
                <NavDropdown
                  label="Reports"
                  items={[
                    { label: 'My Evals', mode: 'my-evals', badge: players.filter((p) => p.myEval !== null).length },
                    { label: 'My Eval Details', mode: 'my-eval-details' },
                    { label: 'Skill Notes', mode: 'my-skill-details' },
                    { label: 'All Fitness Scores', mode: 'all-fitness' },
                    { label: 'Selection', mode: 'selection' },
                    { label: 'Team Packages', mode: 'team-packages' },
                  ]}
                  activeMode={viewMode}
                  onSelect={(mode) => { setViewMode(mode as typeof viewMode); setSearchQuery(''); }}
                  align="right"
                />
                {isAdmin && (
                  <>
                    <div className="w-px my-2 flex-shrink-0" style={{ background: 'rgba(192,57,43,0.3)' }} />
                    <NavDropdown
                      label="Admin"
                      items={[
                        { label: 'All Coach Evals', mode: 'admin-evals' },
                        { label: 'All Skill Notes', mode: 'admin-skill-details' },
                        { label: 'Skill Averages', mode: 'admin-agg-skills' },
                        { label: 'All Packages', mode: 'admin-team-packages' },
                      ]}
                      activeMode={viewMode}
                      onSelect={(mode) => { setViewMode(mode as typeof viewMode); setSearchQuery(''); }}
                      accentColor="#ef9a9a"
                      lockIcon
                      align="right"
                    />
                  </>
                )}
              </div>
            </div>
          )}
        </header>

        {/* ── Main content ── */}
        <main className="px-5 md:px-7 py-7 pb-16 mx-auto" style={{ maxWidth: '1200px' }}>

          {/* Unauthorized */}
          {unauthorized && !loading && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
                style={{ background: 'rgba(192,57,43,0.12)', border: '2px solid rgba(192,57,43,0.35)' }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                </svg>
              </div>
              <h2
                className="text-2xl font-extrabold uppercase tracking-wide mb-2"
                style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#f5f0e8' }}
              >
                Access Restricted
              </h2>
              <p className="text-sm mb-1" style={{ color: 'rgba(245,240,232,0.55)', maxWidth: '320px' }}>
                You are not authorized to view this app.
              </p>
              <p className="text-xs mb-8" style={{ color: 'rgba(245,240,232,0.3)', fontFamily: 'Barlow Condensed, sans-serif' }}>
                Signed in as <span style={{ color: 'rgba(245,240,232,0.55)' }}>{user.email}</span>
              </p>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="text-xs px-4 py-2 rounded border font-bold uppercase tracking-wider transition-opacity hover:opacity-80"
                style={{
                  fontFamily: 'Barlow Condensed, sans-serif',
                  color: '#f5f0e8',
                  borderColor: 'rgba(192,57,43,0.5)',
                  background: 'transparent',
                  letterSpacing: '0.08em',
                }}
              >
                Sign out
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-24">
              <div className="w-10 h-10 rounded-full border-2 animate-spin"
                style={{ borderColor: '#c0392b', borderTopColor: 'transparent' }} />
              <span className="ml-4 text-sm"
                style={{ color: 'rgba(245,240,232,0.5)', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.08em' }}>
                LOADING PLAYERS…
              </span>
            </div>
          )}

          {/* Config error */}
          {error && !loading && (
            <div className="rounded-lg border p-6 mt-4" style={{ background: '#243324', borderColor: 'rgba(192,57,43,0.4)' }}>
              <p className="font-bold mb-2" style={{ color: '#f5f0e8', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1rem' }}>
                Could not load player data
              </p>
              <p className="text-sm mb-4" style={{ color: 'rgba(245,240,232,0.6)' }}>{error}</p>
              <div className="text-sm" style={{ color: 'rgba(245,240,232,0.5)' }}>
                <p className="font-semibold mb-1" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>Setup checklist:</p>
                <ol className="list-decimal ml-5 space-y-1">
                  <li>Add a <code className="text-[#c8a84b]">"tryout"</code> entry to <code className="text-[#c8a84b]">sheets-config.json</code> with your Google Sheet ID</li>
                  <li>Create a tab named <code className="text-[#c8a84b]">Players</code> in your spreadsheet</li>
                  <li>Add headers: <code className="text-[#c8a84b]">Batch, Name, Category, Schema, Score, Pct, Rating, Remarks, Evaluation</code></li>
                  <li>Schema must be "Batsman", "Fast Bowler", or "Spin Bowler"</li>
                </ol>
              </div>
            </div>
          )}

          {/* Empty sheet */}
          {!loading && !error && players.length === 0 && viewMode === 'board' && (
            <div className="rounded-lg border p-8 text-center mt-4"
              style={{ background: '#243324', borderColor: 'rgba(200,168,75,0.2)' }}>
              <p className="text-lg font-bold mb-1" style={{ color: '#f5f0e8', fontFamily: 'Barlow Condensed, sans-serif' }}>
                No players found
              </p>
              <p className="text-sm" style={{ color: 'rgba(245,240,232,0.5)' }}>
                Add rows to your sheet with <code className="text-[#c8a84b]">Batch</code>, <code className="text-[#c8a84b]">Name</code>, <code className="text-[#c8a84b]">Category</code>, and <code className="text-[#c8a84b]">Schema</code> columns.
              </p>
            </div>
          )}

          {/* My Evals table */}
          {!loading && !error && viewMode === 'my-evals' && (
            <MyEvalsTable players={players} onRowClick={setActivePlayer} />
          )}

          {/* My Eval Details table */}
          {!loading && !error && viewMode === 'my-eval-details' && (
            <MyEvalDetailsTable players={players} onRowClick={setActivePlayer} />
          )}

          {/* Skill Notes table */}
          {!loading && !error && viewMode === 'my-skill-details' && (
            <MySkillDetailsTable players={players} onRowClick={setActivePlayer} />
          )}

          {/* All Fitness table */}
          {!loading && !error && viewMode === 'all-fitness' && (
            <AllFitnessTable players={players} allBatchNames={allBatchNames} onRowClick={setActivePlayer} />
          )}

          {/* Selection Summary table */}
          {!loading && !error && viewMode === 'selection' && (
            <SelectionSummaryTable players={players} allBatchNames={allBatchNames} onRowClick={setActivePlayer} />
          )}

          {/* Team Packages */}
          {!loading && !error && viewMode === 'team-packages' && (
            <TeamSelectionBoard players={players} user={user} sheetKey={sheetKey} onPlayerClick={setActivePlayer} />
          )}

          {/* Admin: All Team Packages */}
          {!loading && !error && viewMode === 'admin-team-packages' && isAdmin && (
            <>
              <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: 'rgba(192,57,43,0.2)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef9a9a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#ef9a9a', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em' }}>
                  Admin Report — All Coach Team Packages
                </span>
              </div>
              <TeamSelectionBoard players={players} user={user} sheetKey={sheetKey} initialSubView="admin" onPlayerClick={setActivePlayer} />
            </>
          )}

          {/* Admin: Skill Averages table */}
          {!loading && !error && viewMode === 'admin-agg-skills' && isAdmin && (
            <>
              <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: 'rgba(192,57,43,0.2)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef9a9a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#ef9a9a', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em' }}>
                  Admin Report — Aggregated Skill Averages across All Coaches
                </span>
              </div>
              <AdminAggSkillTable players={players} onRowClick={setActivePlayer} />
            </>
          )}

          {/* Admin: All Skill Notes table */}
          {!loading && !error && viewMode === 'admin-skill-details' && isAdmin && (
            <>
              <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: 'rgba(192,57,43,0.2)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef9a9a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#ef9a9a', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em' }}>
                  Admin Report — All Coaches · Individual Skill Scores &amp; Notes
                </span>
              </div>
              <AdminSkillDetailsTable players={players} onRowClick={setActivePlayer} />
            </>
          )}

          {/* Admin: All Coach Evals table */}
          {!loading && !error && viewMode === 'admin-evals' && isAdmin && (
            <>
              <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: 'rgba(192,57,43,0.2)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef9a9a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#ef9a9a', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em' }}>
                  Admin Report — All Coach Evaluations
                </span>
              </div>
              <AllEvalDetailsTable players={players} onRowClick={setActivePlayer} />
            </>
          )}

          {!loading && !error && players.length > 0 && viewMode === 'board' && (
            <>
              {/* Search result banner */}
              {isSearching && (
                <div className="flex items-center gap-3 mb-6 pb-4 border-b"
                  style={{ borderColor: 'rgba(192,57,43,0.25)' }}>
                  <span style={{ color: 'rgba(245,240,232,0.5)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {batchPlayers.length} result{batchPlayers.length !== 1 ? 's' : ''} across all batches for
                  </span>
                  <span style={{ color: '#f5f0e8', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '0.9rem' }}>
                    "{searchQuery}"
                  </span>
                  <button onClick={() => setSearchQuery('')}
                    style={{ color: 'rgba(245,240,232,0.4)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Clear ✕
                  </button>
                </div>
              )}

              {/* Pinned section — always global */}
              {pinnedPlayers.length > 0 && (
                <section className="mb-9">
                  <SectionHeader
                    label="Pinned"
                    count={pinnedPlayers.length}
                    icon={
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#c0392b" stroke="#c0392b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="17" x2="12" y2="22" />
                        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z" />
                      </svg>
                    }
                  />
                  <PlayerGrid
                    players={pinnedPlayers}
                    pinnedIds={pinnedIds}
                    onCardClick={setActivePlayer}
                    onTogglePin={togglePin}
                    showBatch
                    userEmail={user.email}
                  />
                </section>
              )}

              {/* No search results */}
              {isSearching && batchPlayers.length === 0 && (
                <div className="rounded-lg border p-6 text-center"
                  style={{ background: '#243324', borderColor: 'rgba(200,168,75,0.15)' }}>
                  <p className="font-bold text-base mb-1"
                    style={{ color: '#f5f0e8', fontFamily: 'Barlow Condensed, sans-serif' }}>
                    No players match "{searchQuery}"
                  </p>
                </div>
              )}

              {/* Category groups (within active batch OR search results) */}
              {categoryGroups.map((cat) => (
                <section key={cat.name} className="mb-9">
                  <SectionHeader label={cat.name} count={cat.players.length} />
                  <PlayerGrid
                    players={cat.players}
                    pinnedIds={pinnedIds}
                    onCardClick={setActivePlayer}
                    onTogglePin={togglePin}
                    showBatch={isSearching}
                    userEmail={user.email}
                  />
                </section>
              ))}
            </>
          )}
        </main>
      </div>

      {activePlayer && (
        <PlayerModal
          player={activePlayer}
          userEmail={user.email}
          onClose={() => setActivePlayer(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}
