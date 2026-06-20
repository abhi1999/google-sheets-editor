'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import type { ScoutPlayer, PlayerEvaluation, SchemaType, CoachEval } from '@/types/scout';
import type { AppUser } from '@/types';
import { SCHEMAS, FITNESS_FIELDS, calcScore, getRating, playerInitials, type SectionDef } from '@/lib/scout-schemas';
import Papa from 'papaparse';
import { PlayerModal } from './PlayerModal';

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
  const best = Math.max(...vals);
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
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const toggleSort = useCallback((col: string) => {
    setSortCol((prev) => {
      if (prev === col) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); return col; }
      setSortDir('asc');
      return col;
    });
  }, []);
  return { search, setSearch, sortCol, sortDir, toggleSort };
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
                    {schemaLabel} — {schemaName}
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
                    {schemaLabel} — {schemaName}
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
  const [viewMode, setViewMode] = useState<'board' | 'my-evals' | 'my-eval-details' | 'all-fitness' | 'admin-evals'>('board');
  const [isAdmin, setIsAdmin] = useState(false);

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

          {/* Batch tab bar + My Evals toggle */}
          {!loading && !error && players.length > 0 && (
            <div
              className="batch-tabs flex overflow-x-auto border-t"
              style={{ borderColor: 'rgba(192,57,43,0.2)', scrollbarWidth: 'none' }}
            >
              {/* Batch tabs */}
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

              {/* Divider */}
              <div className="w-px my-2 flex-shrink-0" style={{ background: 'rgba(245,240,232,0.1)' }} />

              {/* My Evals tab */}
              {(() => {
                const myEvalsCount = players.filter((p) => p.myEval !== null).length;
                const isActive = viewMode === 'my-evals';
                return (
                  <button
                    onClick={() => { setViewMode('my-evals'); setSearchQuery(''); }}
                    className="flex-shrink-0 px-5 py-2 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5"
                    style={{
                      fontFamily: 'Barlow Condensed, sans-serif',
                      color: isActive ? '#c8a84b' : 'rgba(200,168,75,0.45)',
                      borderColor: isActive ? '#c8a84b' : 'transparent',
                      background: 'none', cursor: 'pointer', letterSpacing: '0.08em',
                    }}
                    onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'rgba(200,168,75,0.75)'; }}
                    onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'rgba(200,168,75,0.45)'; }}
                  >
                    My Evals
                    {myEvalsCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                        style={{ background: isActive ? 'rgba(200,168,75,0.2)' : 'rgba(200,168,75,0.1)', color: isActive ? '#c8a84b' : 'rgba(200,168,75,0.6)' }}>
                        {myEvalsCount}
                      </span>
                    )}
                  </button>
                );
              })()}

              {/* My Eval Details tab */}
              {(() => {
                const isActive = viewMode === 'my-eval-details';
                return (
                  <button
                    onClick={() => { setViewMode('my-eval-details'); setSearchQuery(''); }}
                    className="flex-shrink-0 px-5 py-2 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors"
                    style={{
                      fontFamily: 'Barlow Condensed, sans-serif',
                      color: isActive ? '#c8a84b' : 'rgba(200,168,75,0.45)',
                      borderColor: isActive ? '#c8a84b' : 'transparent',
                      background: 'none', cursor: 'pointer', letterSpacing: '0.08em',
                    }}
                    onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'rgba(200,168,75,0.75)'; }}
                    onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'rgba(200,168,75,0.45)'; }}
                  >
                    My Eval Details
                  </button>
                );
              })()}

              {/* All Fitness tab */}
              {(() => {
                const isActive = viewMode === 'all-fitness';
                return (
                  <button
                    onClick={() => { setViewMode('all-fitness'); setSearchQuery(''); }}
                    className="flex-shrink-0 px-5 py-2 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors"
                    style={{
                      fontFamily: 'Barlow Condensed, sans-serif',
                      color: isActive ? '#c8a84b' : 'rgba(200,168,75,0.45)',
                      borderColor: isActive ? '#c8a84b' : 'transparent',
                      background: 'none', cursor: 'pointer', letterSpacing: '0.08em',
                    }}
                    onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'rgba(200,168,75,0.75)'; }}
                    onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'rgba(200,168,75,0.45)'; }}
                  >
                    All Fitness
                  </button>
                );
              })()}

              {/* Admin: All Coach Evals tab — only for admins */}
              {isAdmin && (() => {
                const isActive = viewMode === 'admin-evals';
                return (
                  <>
                    <div className="w-px my-2 flex-shrink-0" style={{ background: 'rgba(192,57,43,0.3)' }} />
                    <button
                      onClick={() => { setViewMode('admin-evals'); setSearchQuery(''); }}
                      className="flex-shrink-0 px-5 py-2 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5"
                      style={{
                        fontFamily: 'Barlow Condensed, sans-serif',
                        color: isActive ? '#ef9a9a' : 'rgba(239,154,154,0.45)',
                        borderColor: isActive ? '#c0392b' : 'transparent',
                        background: 'none', cursor: 'pointer', letterSpacing: '0.08em',
                      }}
                      onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'rgba(239,154,154,0.75)'; }}
                      onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'rgba(239,154,154,0.45)'; }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      All Coach Evals
                    </button>
                  </>
                );
              })()}
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

          {/* All Fitness table */}
          {!loading && !error && viewMode === 'all-fitness' && (
            <AllFitnessTable players={players} allBatchNames={allBatchNames} onRowClick={setActivePlayer} />
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
