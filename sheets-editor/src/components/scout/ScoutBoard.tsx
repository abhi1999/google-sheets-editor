'use client';

import { useState, useEffect, useMemo, useCallback, Fragment, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import type { ScoutPlayer, PlayerEvaluation, SchemaType, CoachEval } from '@/types/scout';
import type { AppUser } from '@/types';
import { SCHEMAS, FITNESS_FIELDS, calcScore, getRating, playerInitials, type SectionDef, type SchemaDef } from '@/lib/scout-schemas';
import Papa from 'papaparse';
import { PlayerModal } from './PlayerModal';
import { TeamSelectionBoard } from './TeamSelectionBoard';

interface ScoutBoardProps {
  sheetKey: string;
  user: AppUser;
}

export type YoyoThresholds = { greenMin: number; amberMin: number };
export const DEFAULT_YOYO_THRESHOLDS: YoyoThresholds = { greenMin: 15.5, amberMin: 15.2 };
const YoyoThresholdsCtx = createContext<YoyoThresholds>(DEFAULT_YOYO_THRESHOLDS);

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

function getYoYoBadge(coachEvals: ScoutPlayer['coachEvals'], t: YoyoThresholds = DEFAULT_YOYO_THRESHOLDS): { best: number; bg: string; text: string } | null {
  const vals = coachEvals
    .map((e) => parseFloat(e.evaluation.fitness?.['Yo-Yo'] || ''))
    .filter((v) => !isNaN(v) && v > 0);
  if (vals.length === 0) return null;
  const best = Math.min(...vals);
  if (best >= t.greenMin) return { best, bg: '#1b5e20', text: '#a5d6a7' };
  if (best >= t.amberMin) return { best, bg: '#7f3f00', text: '#ffcc80' };
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
  const t = useContext(YoyoThresholdsCtx);
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
        const yoyo = getYoYoBadge(player.coachEvals, t);
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

function yoyoCategory(coachEvals: ScoutPlayer['coachEvals'], t: YoyoThresholds = DEFAULT_YOYO_THRESHOLDS): YoyoFilterKey {
  const badge = getYoYoBadge(coachEvals, t);
  if (!badge) return 'grey';
  if (badge.best >= t.greenMin) return 'green';
  if (badge.best >= t.amberMin) return 'amber';
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
  const t = useContext(YoyoThresholdsCtx);
  const [yoyoFilter, setYoyoFilter] = useState<YoyoFilterKey>('all');
  const [divFilter, setDivFilter] = useState<string>('all');

  const allDivs = useMemo(() => {
    const seen = new Set<string>();
    for (const p of players) if (p.div) seen.add(p.div);
    return Array.from(seen).sort();
  }, [players]);

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
      const cat = yoyoCategory(player.coachEvals, t);
      for (const ev of player.coachEvals) {
        if (!FITNESS_FIELDS.some((f) => ev.evaluation.fitness?.[f])) continue;
        result.push({ player, coachName: ev.coachName || ev.coachEmail, fitness: ev.evaluation.fitness || {}, cat });
      }
    }
    return result;
  }, [players, allBatchNames, t]);

  const filtered = useMemo(() => {
    let rows = yoyoFilter === 'all' ? allRows : allRows.filter((r) => r.cat === yoyoFilter);
    if (divFilter !== 'all') rows = rows.filter((r) => r.player.div === divFilter);
    return rows;
  }, [allRows, yoyoFilter, divFilter]);

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

  // Count unique players per category for filter badges
  const counts = useMemo(() => {
    const seen: Record<YoyoFilterKey, Set<number>> = { all: new Set(), green: new Set(), amber: new Set(), red: new Set(), grey: new Set() };
    allRows.forEach((r) => {
      seen.all.add(r.player.rowIndex);
      seen[r.cat].add(r.player.rowIndex);
    });
    return { all: seen.all.size, green: seen.green.size, amber: seen.amber.size, red: seen.red.size, grey: seen.grey.size };
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

        {allDivs.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.35)', fontFamily: 'Barlow Condensed, sans-serif' }}>Div:</span>
            {allDivs.map((div) => {
              const active = divFilter === div;
              return (
                <button key={div} onClick={() => setDivFilter(active ? 'all' : div)}
                  className="px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-all"
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    background: active ? 'rgba(200,168,75,0.2)' : 'rgba(255,255,255,0.05)',
                    color: active ? '#c8a84b' : 'rgba(245,240,232,0.4)',
                    border: `1px solid ${active ? 'rgba(200,168,75,0.45)' : 'rgba(245,240,232,0.08)'}`,
                  }}>
                  {div}
                </button>
              );
            })}
            {divFilter !== 'all' && (
              <button onClick={() => setDivFilter('all')} className="text-[10px] font-bold uppercase tracking-wider transition-opacity hover:opacity-70" style={{ color: 'rgba(245,240,232,0.35)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif' }}>Clear ✕</button>
            )}
          </div>
        )}

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
                const badge = getYoYoBadge(row.player.coachEvals, t);
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

function ragCategory(player: ScoutPlayer, t: YoyoThresholds = DEFAULT_YOYO_THRESHOLDS): RagKey {
  const yoyo = maxYoyo(player);
  if (yoyo === null) return 'grey';
  if (yoyo >= t.greenMin) return 'green';
  if (yoyo >= t.amberMin) return 'amber';
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

function exportSelectionToCSV(players: ScoutPlayer[], t: YoyoThresholds) {
  const data = players.map((p) => {
    const yoyo = maxYoyo(p);
    const rag = ragCategory(p, t);
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
  const t = useContext(YoyoThresholdsCtx);
  const [ragFilters, setRagFilters] = useState<Set<RagKey>>(new Set());
  const [catFilters, setCatFilters] = useState<Set<string>>(new Set());
  const [divFilter, setDivFilter] = useState<string>('all');

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

  const allDivs = useMemo(() => {
    const seen = new Set<string>();
    for (const p of players) if (p.div) seen.add(p.div);
    return Array.from(seen).sort();
  }, [players]);

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
    baseRows.forEach((p) => { c[ragCategory(p, t)]++; });
    return c;
  }, [baseRows, t]);

  const filtered = useMemo(() => {
    return baseRows.filter((p) => {
      if (ragFilters.size > 0 && !ragFilters.has(ragCategory(p, t))) return false;
      if (catFilters.size > 0 && !catFilters.has(p.category)) return false;
      if (divFilter !== 'all' && p.div !== divFilter) return false;
      return true;
    });
  }, [baseRows, ragFilters, catFilters, divFilter, t]);

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
      if (col === 'RAG')       return ragCategory(p, t);
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

        {/* Div filter chips */}
        {allDivs.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(245,240,232,0.35)', fontFamily: 'Barlow Condensed, sans-serif' }}>Div</span>
              {divFilter !== 'all' && (
                <button onClick={() => setDivFilter('all')} className="text-[10px] font-bold uppercase tracking-wider transition-opacity hover:opacity-70" style={{ color: 'rgba(245,240,232,0.35)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif' }}>
                  Clear ✕
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {allDivs.map((div) => {
                const isActive = divFilter === div;
                return (
                  <button key={div} onClick={() => setDivFilter(isActive ? 'all' : div)}
                    className="px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-all"
                    style={{
                      fontFamily: 'Barlow Condensed, sans-serif',
                      background: isActive ? 'rgba(200,168,75,0.2)' : 'rgba(255,255,255,0.05)',
                      color: isActive ? '#c8a84b' : 'rgba(245,240,232,0.45)',
                      border: `1px solid ${isActive ? 'rgba(200,168,75,0.45)' : 'rgba(245,240,232,0.08)'}`,
                    }}>
                    {div}
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
            onClick={() => exportSelectionToCSV(displayRows, t)}
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
              const rag = ragCategory(p, t);
              const rs = ragStyle(rag);
              const yoyo = maxYoyo(p);
              const yoyoBadge = yoyo !== null
                ? (yoyo >= t.greenMin ? { color: '#a5d6a7', bg: 'rgba(27,94,32,0.35)' }
                  : yoyo >= t.amberMin ? { color: '#ffcc80', bg: 'rgba(127,63,0,0.35)' }
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
  const t = useContext(YoyoThresholdsCtx);
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
      : coachFiltered.filter((r) => yoyoCategory(r.player.coachEvals, t) === yoyoFilter);
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
      c[yoyoCategory(r.player.coachEvals, t)]++;
      c.all++;
    }
    return c;
  }, [allRows, t]);
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
                      {(() => { const yoyo = maxYoyo(r.player); if (yoyo === null) return <span style={{ color: 'rgba(245,240,232,0.2)' }}>—</span>; const badge = getYoYoBadge(r.player.coachEvals, t); return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: badge?.bg ?? 'rgba(0,0,0,0.2)', color: badge?.text ?? 'rgba(245,240,232,0.4)', fontFamily: 'Barlow Condensed, sans-serif' }}>{yoyo}</span>; })()}
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
    'Avg Score': r.avgScore > 0 ? r.avgScore.toFixed(5) : '',
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
  const t = useContext(YoyoThresholdsCtx);
  const [coachFilters, setCoachFilters] = useState<Set<string>>(new Set());
  const [yoyoFilter, setYoyoFilter] = useState<YoyoFilterKey>('all');
  const [schemaFilters, setSchemaFilters] = useState<Set<SchemaType>>(new Set());
  const [divFilter, setDivFilter] = useState<string>('all');
  const { search, setSearch, sortCol, sortDir, toggleSort } = useSortSearch();

  function toggleCoach(email: string) {
    setCoachFilters((prev) => { const n = new Set(prev); n.has(email) ? n.delete(email) : n.add(email); return n; });
  }
  function toggleSchema(s: SchemaType) {
    setSchemaFilters((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  }

  const allDivs = useMemo(() => {
    const seen = new Set<string>();
    for (const p of players) if (p.div) seen.add(p.div);
    return Array.from(seen).sort();
  }, [players]);

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
    for (const p of seen.values()) counts[yoyoCategory(p.coachEvals, t)]++;
    return counts;
  }, [allRows, t]);

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
    const afterYoyo = yoyoFilter === 'all' ? afterSearch : afterSearch.filter((r) => yoyoCategory(r.player.coachEvals, t) === yoyoFilter);
    const afterSchema = schemaFilters.size > 0 ? afterYoyo.filter((r) => schemaFilters.has(r.schemaName)) : afterYoyo;
    const afterDiv = divFilter === 'all' ? afterSchema : afterSchema.filter((r) => r.player.div === divFilter);
    return applySort(afterDiv, sortCol, sortDir, (r, col) => {
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
  }, [allRows, search, yoyoFilter, schemaFilters, divFilter, sortCol, sortDir]);

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

      {/* Div filter */}
      {allDivs.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest mr-1" style={{ color: 'rgba(245,240,232,0.35)', fontFamily: 'Barlow Condensed, sans-serif' }}>Div:</span>
          {allDivs.map((div) => {
            const active = divFilter === div;
            return (
              <button key={div} onClick={() => setDivFilter(active ? 'all' : div)}
                className="px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-all"
                style={{
                  fontFamily: 'Barlow Condensed, sans-serif',
                  background: active ? 'rgba(200,168,75,0.2)' : 'rgba(255,255,255,0.05)',
                  color: active ? '#c8a84b' : 'rgba(245,240,232,0.4)',
                  border: `1px solid ${active ? 'rgba(200,168,75,0.45)' : 'rgba(245,240,232,0.08)'}`,
                }}>
                {div}
              </button>
            );
          })}
          {divFilter !== 'all' && (
            <button onClick={() => setDivFilter('all')} className="text-[10px] font-bold uppercase tracking-wider transition-opacity hover:opacity-70" style={{ color: 'rgba(245,240,232,0.35)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif' }}>
              Clear ✕
            </button>
          )}
        </div>
      )}

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
                          {r.avgScore.toFixed(3)}/5
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
                        const cat = yoyoCategory(r.player.coachEvals, t);
                        const clr = cat === 'green' ? '#81c784' : cat === 'amber' ? '#ffb74d' : '#ef9a9a';
                        return <span className="font-bold text-[11px]" style={{ color: clr, fontFamily: 'Barlow Condensed, sans-serif' }}>{yy.toFixed(3)}</span>;
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

// ── Admin Pivot Table ─────────────────────────────────────────────────

type PivotPopover = {
  playerName: string;
  skillName: string;
  entries: { coachName: string; score: number }[];
  x: number;
  y: number;
};

type RemarksPopover = {
  playerName: string;
  items: { coachName: string; remark: string }[];
  x: number;
  y: number;
};

type SchemaCoverage = { category: string; yoyo: YoyoFilterKey; threshold: number; bowlTypes: string[] };
const DEFAULT_SCHEMA_COVERAGE: Record<SchemaType, SchemaCoverage> = {
  Batsman: { category: 'all', yoyo: 'all', threshold: 0, bowlTypes: [] },
  'Fast Bowler': { category: 'all', yoyo: 'all', threshold: 0, bowlTypes: [] },
  'Spin Bowler': { category: 'all', yoyo: 'all', threshold: 0, bowlTypes: [] },
};

type PivotSavedFilter = {
  id: string;
  name: string;
  schemaFilter: SchemaType | 'all';
  yoyoFilter: YoyoFilterKey;
  categoryFilter: string;
  schemaCoverage: Record<SchemaType, SchemaCoverage>;
};


function exportPivotToCSV(players: ScoutPlayer[], visibleSkillKeys: Set<string>) {
  const schemaEntries = Object.entries(SCHEMAS) as [SchemaType, SchemaDef][];
  type CsvRow = Record<string, string | number>;
  const rows: CsvRow[] = players.map((p) => {
    const yoyoVals = p.coachEvals
      .map((e) => parseFloat(e.evaluation.fitness?.['Yo-Yo'] || ''))
      .filter((v) => !isNaN(v) && v > 0);
    const row: CsvRow = {
      Player: p.name,
      Batch: p.batch || '',
      Div: p.div || '',
      Category: p.category || '',
      Schema: p.schema,
      'Yo-Yo': yoyoVals.length > 0 ? Math.min(...yoyoVals) : '',
      'Primary Skill': p.extraInfo?.['Primary Skill'] || '',
      'Batting Hand': p.extraInfo?.['Batting hand'] || '',
      'Bowler Arm': p.extraInfo?.['Bowler arm'] || '',
      'Bowling Type': p.extraInfo?.['Bowling type'] || '',
    };
    for (const [schemaName, def] of schemaEntries) {
      const label = schemaName === 'Batsman' ? 'BAT' : schemaName === 'Fast Bowler' ? 'FB' : 'SB';
      const isMatchingSchema = p.schema === schemaName;
      const schemaSkillAvgs: number[] = [];
      for (const sec of def.sections) {
        const visSkills = sec.skills.filter((sk) => visibleSkillKeys.has(`${schemaName}|${sec.letter}|${sk.name}`));
        if (visSkills.length === 0) continue;
        const secSkillAvgs: number[] = [];
        for (const sk of visSkills) {
          const colKey = `${label} ${sec.letter}:${sec.name} - ${sk.name}`;
          if (!isMatchingSchema) {
            row[`${colKey} Avg`] = '';
            row[`${colKey} N`] = '';
          } else {
            const scores = p.coachEvals.map((e) => e.evaluation.skills?.[sk.name] || 0).filter((s) => s > 0);
            if (scores.length > 0) {
              const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
              row[`${colKey} Avg`] = avg.toFixed(5);
              row[`${colKey} N`] = scores.length;
              secSkillAvgs.push(avg);
              schemaSkillAvgs.push(avg);
            } else {
              row[`${colKey} Avg`] = '';
              row[`${colKey} N`] = '';
            }
          }
        }
        const secAvgKey = `${label} ${sec.letter}:${sec.name} Sec Avg`;
        row[secAvgKey] = isMatchingSchema && secSkillAvgs.length > 0
          ? (secSkillAvgs.reduce((a, b) => a + b, 0) / secSkillAvgs.length).toFixed(5)
          : '';
      }
      const schemaAvgKey = `${label} Avg`;
      row[schemaAvgKey] = isMatchingSchema && schemaSkillAvgs.length > 0
        ? (schemaSkillAvgs.reduce((a, b) => a + b, 0) / schemaSkillAvgs.length).toFixed(5)
        : '';
    }
    row['Remarks'] = p.coachEvals
      .filter((e) => (e.remarks || '').trim())
      .map((e) => `${e.coachName || e.coachEmail}: ${e.remarks}`)
      .join(' | ');
    return row;
  });
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `skill-pivot-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function skillScoreColor(avg: number): { bg: string; color: string } {
  if (avg >= 4) return { bg: 'rgba(27,94,32,0.45)', color: '#a5d6a7' };
  if (avg >= 3) return { bg: 'rgba(27,94,32,0.2)', color: '#81c784' };
  if (avg >= 2) return { bg: 'rgba(127,63,0,0.35)', color: '#ffcc80' };
  return { bg: 'rgba(127,31,31,0.35)', color: '#ef9a9a' };
}

function AdminPivotTable({
  players,
  onRowClick,
  sheetKey,
  allowCoachBreakdown = false,
}: {
  players: ScoutPlayer[];
  onRowClick: (p: ScoutPlayer) => void;
  sheetKey: string;
  allowCoachBreakdown?: boolean;
}) {
  const t = useContext(YoyoThresholdsCtx);
  const [schemaFilter, setSchemaFilter] = useState<SchemaType | 'all'>('all');
  const [yoyoFilter, setYoyoFilter] = useState<YoyoFilterKey>('all');
  const [search, setSearch] = useState('');
  const [popover, setPopover] = useState<PivotPopover | null>(null);
  const [remarksPopover, setRemarksPopover] = useState<RemarksPopover | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [divFilter, setDivFilter] = useState<string>('all');
  const [selectedCoaches, setSelectedCoaches] = useState<Set<string> | null>(null); // null = all
  const [showExtraCols, setShowExtraCols] = useState(true);
  // Per-schema coverage filter — controls which skill columns are visible
  const [schemaCoverage, setSchemaCoverage] = useState<Record<SchemaType, SchemaCoverage>>(() => ({ ...DEFAULT_SCHEMA_COVERAGE }));
  const [showCoveragePanel, setShowCoveragePanel] = useState(false);

  function updateCov(schema: SchemaType, patch: Partial<SchemaCoverage>) {
    setSchemaCoverage((prev) => ({ ...prev, [schema]: { ...prev[schema], ...patch } }));
  }
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      setShowExtraCols(false);
    }
  }, []);

  // Saved filters — persisted in the Sheet (shared across all coaches)
  const [savedFilters, setSavedFilters] = useState<PivotSavedFilter[]>([]);
  const [filterName, setFilterName] = useState('');
  const [filterSaving, setFilterSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/scout/pivot-filters?sheetKey=${encodeURIComponent(sheetKey)}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data.filters)) setSavedFilters(data.filters); })
      .catch(() => {});
  }, [sheetKey]);

  const schemaEntries = useMemo(
    () => Object.entries(SCHEMAS) as [SchemaType, SchemaDef][],
    []
  );

  const visibleSchemas = schemaFilter === 'all'
    ? schemaEntries
    : schemaEntries.filter(([name]) => name === schemaFilter);

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const p of players) if (p.category) cats.add(p.category);
    return Array.from(cats).sort();
  }, [players]);

  const allDivs = useMemo(() => {
    const seen = new Set<string>();
    for (const p of players) if (p.div) seen.add(p.div);
    return Array.from(seen).sort();
  }, [players]);

  const allCoaches = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of players) {
      for (const e of p.coachEvals) {
        if (e.coachEmail) map.set(e.coachEmail, e.coachName || e.coachEmail);
      }
    }
    return Array.from(map.entries()).map(([email, name]) => ({ email, name }));
  }, [players]);

  function toggleCoach(email: string) {
    const prev = selectedCoaches;
    if (prev === null) {
      const next = new Set(allCoaches.map((c) => c.email).filter((e) => e !== email));
      setSelectedCoaches(next.size === 0 ? null : next);
    } else {
      const next = new Set(prev);
      if (next.has(email)) {
        next.delete(email);
        setSelectedCoaches(next.size === 0 ? null : next);
      } else {
        next.add(email);
        setSelectedCoaches(next.size === allCoaches.length ? null : next);
      }
    }
  }

  const effectivePlayers = useMemo(() => {
    if (selectedCoaches === null) return players;
    return players.map((p) => ({
      ...p,
      coachEvals: p.coachEvals.map((e) =>
        selectedCoaches.has(e.coachEmail)
          ? e
          : { ...e, evaluation: { ...e.evaluation, skills: {} } }
      ),
    }));
  }, [players, selectedCoaches]);

  // Which skill columns to show — evaluated per-schema using each schema's own coverage settings
  const visibleSkillKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const [schemaName, def] of schemaEntries) {
      const cov = schemaCoverage[schemaName];
      const coveragePlayers = effectivePlayers.filter((p) => {
        if (p.coachEvals.length === 0) return false;
        // include any player who has at least one coach eval rating on this schema's skills
        const hasSchemaRating = p.coachEvals.some((e) =>
          SCHEMAS[schemaName].sections.some((sec) =>
            sec.skills.some((sk) => (e.evaluation.skills?.[sk.name] || 0) > 0)
          )
        );
        if (!hasSchemaRating) return false;
        if (cov.category !== 'all' && p.category !== cov.category) return false;
        if (cov.yoyo !== 'all' && yoyoCategory(p.coachEvals, t) !== cov.yoyo) return false;
        if (cov.bowlTypes.length > 0) {
          const bt = (p.extraInfo?.['Bowling type'] || '').trim();
          if (!cov.bowlTypes.includes(bt)) return false;
        }
        return true;
      });
      const total = coveragePlayers.length;
      for (const sec of def.sections) {
        for (const sk of sec.skills) {
          const key = `${schemaName}|${sec.letter}|${sk.name}`;
          if (total === 0) {
            if (cov.threshold === 0) keys.add(key);
          } else {
            const ratedCount = coveragePlayers.filter((p) =>
              p.coachEvals.some((e) => (e.evaluation.skills?.[sk.name] || 0) > 0)
            ).length;
            const pct = (ratedCount / total) * 100;
            if (cov.threshold === 0 ? ratedCount > 0 : pct >= cov.threshold) {
              keys.add(key);
            }
          }
        }
      }
    }
    return keys;
  }, [effectivePlayers, schemaEntries, schemaCoverage]);

  // Visible sections per schema (only sections with ≥1 visible skill)
  type VisSection = { sec: SectionDef; visSkills: SectionDef['skills'] };
  function getVisibleSections(schemaName: SchemaType, def: SchemaDef): VisSection[] {
    return def.sections
      .map((sec) => ({
        sec,
        visSkills: sec.skills.filter((sk) => visibleSkillKeys.has(`${schemaName}|${sec.letter}|${sk.name}`)),
      }))
      .filter(({ visSkills }) => visSkills.length > 0);
  }

  function getSkillStat(player: ScoutPlayer, skillName: string) {
    const entries = player.coachEvals
      .map((e) => ({ coachName: e.coachName || e.coachEmail, score: e.evaluation.skills?.[skillName] || 0 }))
      .filter((e) => e.score > 0);
    if (!entries.length) return null;
    const avg = entries.reduce((s, e) => s + e.score, 0) / entries.length;
    return { avg, count: entries.length, entries };
  }

  // Avg over only the visible skills in a section/schema
  function getSectionAvgVis(player: ScoutPlayer, visSkills: SectionDef['skills']): number | null {
    const avgs: number[] = [];
    for (const sk of visSkills) {
      const stat = getSkillStat(player, sk.name);
      if (stat !== null) avgs.push(stat.avg);
    }
    if (!avgs.length) return null;
    return avgs.reduce((a, b) => a + b, 0) / avgs.length;
  }

  function getSchemaAvgVis(player: ScoutPlayer, visSecs: VisSection[]): number | null {
    const avgs: number[] = [];
    for (const { visSkills } of visSecs) {
      for (const sk of visSkills) {
        const stat = getSkillStat(player, sk.name);
        if (stat !== null) avgs.push(stat.avg);
      }
    }
    if (!avgs.length) return null;
    return avgs.reduce((a, b) => a + b, 0) / avgs.length;
  }

  // Save / load / delete filter helpers
  async function handleSaveFilter() {
    if (!filterName.trim() || filterSaving) return;
    const next: PivotSavedFilter = {
      id: `pf_${Date.now()}`,
      name: filterName.trim(),
      schemaFilter, yoyoFilter, categoryFilter, schemaCoverage,
    };
    setFilterSaving(true);
    try {
      const res = await fetch(`/api/scout/pivot-filters?sheetKey=${encodeURIComponent(sheetKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (res.ok) {
        setSavedFilters((prev) => [...prev, next]);
        setFilterName('');
      }
    } catch {}
    setFilterSaving(false);
  }
  function handleLoadFilter(f: PivotSavedFilter) {
    setSchemaFilter(f.schemaFilter);
    setYoyoFilter(f.yoyoFilter);
    setCategoryFilter(f.categoryFilter ?? 'all');
    const loaded = f.schemaCoverage ?? DEFAULT_SCHEMA_COVERAGE;
    setSchemaCoverage({
      ...DEFAULT_SCHEMA_COVERAGE,
      ...Object.fromEntries(
        (Object.keys(loaded) as SchemaType[]).map((k) => [k, { ...loaded[k], bowlTypes: loaded[k].bowlTypes ?? [] }])
      ),
    } as Record<SchemaType, SchemaCoverage>);
  }
  async function handleDeleteFilter(id: string) {
    setSavedFilters((prev) => prev.filter((f) => f.id !== id));
    try {
      await fetch(
        `/api/scout/pivot-filters?sheetKey=${encodeURIComponent(sheetKey)}&filterId=${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      );
    } catch {}
  }

  // Player visibility (yoyo/category/div/search) always uses original evals so coach filter
  // only affects score calculations, not which players appear in the list.
  const filteredPlayers = useMemo(() => {
    const q = search.toLowerCase();
    const visibleIndexes = new Set(
      players.filter((p) => {
        if (yoyoFilter !== 'all' && yoyoCategory(p.coachEvals, t) !== yoyoFilter) return false;
        if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
        if (divFilter !== 'all' && p.div !== divFilter) return false;
        if (q && !matchesSearch(p, q)) return false;
        return true;
      }).map((p) => p.rowIndex)
    );
    return effectivePlayers.filter((p) => visibleIndexes.has(p.rowIndex));
  }, [players, effectivePlayers, yoyoFilter, categoryFilter, divFilter, search, t]);

  const yoyoCounts = useMemo(() => {
    const q = search.toLowerCase();
    const pool = players.filter((p) => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (divFilter !== 'all' && p.div !== divFilter) return false;
      if (q && !matchesSearch(p, q)) return false;
      return true;
    });
    const counts: Record<YoyoFilterKey, number> = { all: pool.length, green: 0, amber: 0, red: 0, grey: 0 };
    pool.forEach((p) => { counts[yoyoCategory(p.coachEvals, t)]++; });
    return counts;
  }, [players, categoryFilter, divFilter, search, t]);

  const categoryCounts = useMemo(() => {
    const q = search.toLowerCase();
    const counts: Record<string, number> = {};
    players.filter((p) => {
      if (yoyoFilter !== 'all' && yoyoCategory(p.coachEvals, t) !== yoyoFilter) return false;
      if (divFilter !== 'all' && p.div !== divFilter) return false;
      if (q && !matchesSearch(p, q)) return false;
      return true;
    }).forEach((p) => {
      if (p.category) counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  }, [players, yoyoFilter, divFilter, search, t]);

  const [pivotSortCol, setPivotSortCol] = useState<string | null>(null);
  const [pivotSortDir, setPivotSortDir] = useState<'asc' | 'desc'>('desc');

  function togglePivotSort(col: string, defaultDir: 'asc' | 'desc' = 'desc') {
    if (pivotSortCol === col) {
      setPivotSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setPivotSortCol(col);
      setPivotSortDir(defaultDir);
    }
  }

  function sortIndicator(col: string) {
    if (pivotSortCol !== col) return null;
    return <span style={{ marginLeft: 2, fontSize: 9, opacity: 0.8 }}>{pivotSortDir === 'desc' ? '↓' : '↑'}</span>;
  }

  const sortedPlayers = useMemo(() => {
    if (!pivotSortCol) return filteredPlayers;
    return [...filteredPlayers].sort((a, b) => {
      // String sorts
      const STR_SORTS: Record<string, (p: ScoutPlayer) => string> = {
        'player':       (p) => p.name,
        'category':     (p) => p.category || '',
        'div':          (p) => p.div || '',
        'primary-skill':(p) => p.extraInfo?.['Primary Skill'] || '',
        'batting-hand': (p) => p.extraInfo?.['Batting hand'] || '',
        'bowler-arm':   (p) => p.extraInfo?.['Bowler arm'] || '',
        'bowling-type': (p) => p.extraInfo?.['Bowling type'] || '',
      };
      if (STR_SORTS[pivotSortCol]) {
        const sa = STR_SORTS[pivotSortCol](a).toLowerCase();
        const sb = STR_SORTS[pivotSortCol](b).toLowerCase();
        return pivotSortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
      }
      if (pivotSortCol === 'yoyo') {
        const getYoyo = (p: ScoutPlayer) => {
          const vals = p.coachEvals.map((e) => parseFloat(e.evaluation.fitness?.['Yo-Yo'] || '')).filter((v) => !isNaN(v) && v > 0);
          return vals.length > 0 ? Math.min(...vals) : null;
        };
        const va2 = getYoyo(a), vb2 = getYoyo(b);
        if (va2 === null && vb2 === null) return 0;
        if (va2 === null) return 1;
        if (vb2 === null) return -1;
        return pivotSortDir === 'desc' ? vb2 - va2 : va2 - vb2;
      }
      // Numeric sorts (schema/section averages)
      let va: number | null = null;
      let vb: number | null = null;
      if (pivotSortCol.startsWith('schema:')) {
        const schemaName = pivotSortCol.slice(7) as SchemaType;
        const def = SCHEMAS[schemaName];
        const visSecs = getVisibleSections(schemaName, def);
        va = getSchemaAvgVis(a, visSecs);
        vb = getSchemaAvgVis(b, visSecs);
      } else if (pivotSortCol.startsWith('sec:')) {
        const rest = pivotSortCol.slice(4);
        const barIdx = rest.indexOf('|');
        const schemaName = rest.slice(0, barIdx) as SchemaType;
        const secLetter = rest.slice(barIdx + 1);
        const def = SCHEMAS[schemaName];
        const visSecs = getVisibleSections(schemaName, def);
        const visSecData = visSecs.find(({ sec }) => sec.letter === secLetter);
        if (visSecData) {
          va = getSectionAvgVis(a, visSecData.visSkills);
          vb = getSectionAvgVis(b, visSecData.visSkills);
        }
      }
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return pivotSortDir === 'desc' ? vb - va : va - vb;
    });
  }, [filteredPlayers, pivotSortCol, pivotSortDir, visibleSkillKeys]);

  useEffect(() => {
    if (!popover) return;
    const close = () => setPopover(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [!!popover]);

  useEffect(() => {
    if (!remarksPopover) return;
    const close = () => setRemarksPopover(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [!!remarksPopover]);

  const PLAYER_W = 150;
  const YOYO_W = 65;
  const CAT_W = 115;
  const DIV_W = 52;
  const PRIM_W = 75;
  const BAT_HAND_W = 52;
  const BOWL_ARM_W = 52;
  const BOWL_TYPE_W = 80;

  const stickyCellStyle = (left: number, w: number, bg: string, zIndex = 2): React.CSSProperties => ({
    position: 'sticky',
    left,
    width: w,
    minWidth: w,
    maxWidth: w,
    zIndex,
    background: bg,
    boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.06)',
  });

  const TH_BASE: React.CSSProperties = {
    padding: '5px 6px',
    fontSize: 10,
    fontFamily: 'Barlow Condensed, sans-serif',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid rgba(192,57,43,0.25)',
    borderRight: '1px solid rgba(255,255,255,0.05)',
    background: '#1a1010',
    color: 'rgba(245,240,232,0.5)',
    verticalAlign: 'bottom',
  };

  if (players.filter((p) => p.coachEvals.length > 0).length === 0) {
    return (
      <div className="rounded-lg border p-10 text-center mt-4"
        style={{ background: '#2a1a1a', borderColor: 'rgba(192,57,43,0.2)' }}>
        <p className="text-lg font-bold mb-1" style={{ color: '#f5f0e8', fontFamily: 'Barlow Condensed, sans-serif' }}>No data yet</p>
        <p className="text-sm" style={{ color: 'rgba(245,240,232,0.45)' }}>Skill pivot will appear once coaches have rated players.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <TableSearch value={search} onChange={setSearch} />
        <div className="flex items-center gap-1">
          {YOYO_FILTERS.filter((f) => f.key !== 'all').map((f) => {
            const active = yoyoFilter === f.key;
            return (
              <button key={f.key} onClick={() => setYoyoFilter(active ? 'all' : f.key)}
                style={{
                  padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                  fontFamily: 'Barlow Condensed, sans-serif',
                  background: active ? f.activeBg : 'rgba(255,255,255,0.05)',
                  color: active ? f.text : 'rgba(245,240,232,0.4)',
                  border: `1px solid ${active ? 'transparent' : 'rgba(255,255,255,0.08)'}`,
                  cursor: 'pointer',
                }}>
                {f.label}
                <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.7 }}>({yoyoCounts[f.key]})</span>
              </button>
            );
          })}
        </div>
        {allCategories.length > 0 && (
          <div className="flex items-center gap-1">
            {allCategories.map((cat) => {
              const active = categoryFilter === cat;
              const cc = getCategoryColor(cat);
              return (
                <button key={cat} onClick={() => setCategoryFilter(active ? 'all' : cat)}
                  style={{
                    padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                    fontFamily: 'Barlow Condensed, sans-serif',
                    background: active ? cc.bg : 'rgba(255,255,255,0.05)',
                    color: active ? cc.text : 'rgba(245,240,232,0.4)',
                    border: `1px solid ${active ? 'transparent' : 'rgba(255,255,255,0.08)'}`,
                    cursor: 'pointer',
                  }}>
                  {cat}
                  <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.7 }}>({categoryCounts[cat] ?? 0})</span>
                </button>
              );
            })}
          </div>
        )}
        {allDivs.length > 0 && (
          <div className="flex items-center gap-1">
            <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.35)', fontFamily: 'Barlow Condensed, sans-serif', marginRight: 2 }}>Div:</span>
            {allDivs.map((div) => {
              const active = divFilter === div;
              return (
                <button key={div} onClick={() => setDivFilter(active ? 'all' : div)}
                  style={{
                    padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                    fontFamily: 'Barlow Condensed, sans-serif',
                    background: active ? 'rgba(200,168,75,0.2)' : 'rgba(255,255,255,0.05)',
                    color: active ? '#c8a84b' : 'rgba(245,240,232,0.4)',
                    border: `1px solid ${active ? 'rgba(200,168,75,0.45)' : 'rgba(255,255,255,0.08)'}`,
                    cursor: 'pointer',
                  }}>
                  {div}
                </button>
              );
            })}
          </div>
        )}
        {allCoaches.length > 1 && (
          <div className="flex items-center gap-1">
            <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.35)', fontFamily: 'Barlow Condensed, sans-serif', marginRight: 2 }}>Coaches:</span>
            {allCoaches.map((coach) => {
              const active = selectedCoaches === null || selectedCoaches.has(coach.email);
              const initials = coach.name.split(/\s+/).map((w: string) => w[0] || '').join('').slice(0, 2).toUpperCase();
              return (
                <button key={coach.email} onClick={() => toggleCoach(coach.email)}
                  title={coach.name}
                  style={{
                    padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                    fontFamily: 'Barlow Condensed, sans-serif',
                    background: active ? 'rgba(200,168,75,0.2)' : 'rgba(255,255,255,0.05)',
                    color: active ? '#c8a84b' : 'rgba(245,240,232,0.25)',
                    border: `1px solid ${active ? 'rgba(200,168,75,0.45)' : 'rgba(255,255,255,0.08)'}`,
                    cursor: 'pointer',
                  }}>
                  {initials}
                </button>
              );
            })}
            {selectedCoaches !== null && (
              <button onClick={() => setSelectedCoaches(null)}
                style={{
                  padding: '3px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                  fontFamily: 'Barlow Condensed, sans-serif',
                  background: 'rgba(192,57,43,0.12)', color: 'rgba(220,100,90,0.85)',
                  border: '1px solid rgba(192,57,43,0.3)', cursor: 'pointer',
                }}>
                ✕
              </button>
            )}
          </div>
        )}
        <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.3)', fontFamily: 'Barlow Condensed, sans-serif', marginLeft: 4 }}>
          {filteredPlayers.length} player{filteredPlayers.length !== 1 ? 's' : ''} · {visibleSkillKeys.size} skill{visibleSkillKeys.size !== 1 ? 's' : ''} visible
        </span>
        <button
          onClick={() => exportPivotToCSV(filteredPlayers, visibleSkillKeys)}
          style={EXPORT_BTN_STYLE}
          className="transition-opacity hover:opacity-80"
          title="Export to CSV (visible skills only)">
          ↓ Export CSV
        </button>
        <button
          onClick={() => setShowCoveragePanel((v) => !v)}
          style={{
            padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700,
            fontFamily: 'Barlow Condensed, sans-serif',
            background: showCoveragePanel || (Object.values(schemaCoverage).some((c) => c.category !== 'all' || c.yoyo !== 'all' || c.threshold > 0)) ? 'rgba(200,168,75,0.15)' : 'rgba(255,255,255,0.05)',
            color: showCoveragePanel || (Object.values(schemaCoverage).some((c) => c.category !== 'all' || c.yoyo !== 'all' || c.threshold > 0)) ? '#c8a84b' : 'rgba(245,240,232,0.5)',
            border: `1px solid ${showCoveragePanel || (Object.values(schemaCoverage).some((c) => c.category !== 'all' || c.yoyo !== 'all' || c.threshold > 0)) ? 'rgba(200,168,75,0.4)' : 'rgba(255,255,255,0.1)'}`,
            cursor: 'pointer',
          }}>
          ⚙ Skill Filter {showCoveragePanel ? '▲' : '▼'}
        </button>
        {Object.values(schemaCoverage).some((c) => c.category !== 'all' || c.yoyo !== 'all' || c.threshold > 0) && (
          <button
            onClick={() => setSchemaCoverage({ ...DEFAULT_SCHEMA_COVERAGE })}
            style={{
              padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700,
              fontFamily: 'Barlow Condensed, sans-serif',
              background: 'rgba(192,57,43,0.12)', color: 'rgba(220,100,90,0.85)',
              border: '1px solid rgba(192,57,43,0.3)', cursor: 'pointer',
            }}>
            ✕ reset skills
          </button>
        )}
        <button
          onClick={() => setShowExtraCols((v) => !v)}
          title={showExtraCols ? 'Hide Skill/Hand/Arm/Bowl Type columns' : 'Show Skill/Hand/Arm/Bowl Type columns'}
          style={{
            padding: '3px 9px', borderRadius: 4, fontSize: 11, fontWeight: 700,
            fontFamily: 'Barlow Condensed, sans-serif',
            background: showExtraCols ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
            color: showExtraCols ? 'rgba(245,240,232,0.55)' : 'rgba(245,240,232,0.3)',
            border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
          }}>
          {showExtraCols ? '⊟' : '⊞'} Info cols
        </button>
      </div>

      {/* Coverage filter panel — one row per schema */}
      {showCoveragePanel && (
        <div style={{ background: 'rgba(200,168,75,0.05)', border: '1px solid rgba(200,168,75,0.2)', borderRadius: 6, padding: '10px 12px', marginBottom: 10 }}>
          <div className="flex flex-col gap-2">
            {schemaEntries.map(([schemaName, def]) => {
              const cov = schemaCoverage[schemaName];
              const color = SCHEMA_COLORS[schemaName];
              const label = schemaName === 'Batsman' ? 'BAT' : schemaName === 'Fast Bowler' ? 'FB' : 'SB';
              const totalSkills = def.sections.reduce((s, sec) => s + sec.skills.length, 0);
              const visCount = def.sections.flatMap((sec) => sec.skills.map((sk) => `${schemaName}|${sec.letter}|${sk.name}`)).filter((k) => visibleSkillKeys.has(k)).length;
              const isActive = cov.category !== 'all' || cov.yoyo !== 'all' || cov.threshold > 0 || cov.bowlTypes.length > 0;
              const availBowlTypes = schemaName !== 'Batsman'
                ? [...new Set(players.filter((p) => {
                    if (!(p.extraInfo?.['Bowling type'] || '').trim()) return false;
                    return p.coachEvals.some((e) =>
                      SCHEMAS[schemaName].sections.some((sec) =>
                        sec.skills.some((sk) => (e.evaluation.skills?.[sk.name] || 0) > 0)
                      )
                    );
                  }).map((p) => p.extraInfo!['Bowling type'].trim()))].sort()
                : [];
              return (
                <div key={schemaName} className="flex flex-wrap items-center gap-3"
                  style={{ padding: '5px 8px', borderRadius: 5, background: isActive ? `${color}0d` : 'transparent', border: `1px solid ${isActive ? color + '33' : 'transparent'}` }}>
                  <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'Barlow Condensed, sans-serif', color, letterSpacing: '0.08em', minWidth: 26 }}>{label}</span>
                  <select value={cov.category} onChange={(e) => updateCov(schemaName, { category: e.target.value })}
                    style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, fontFamily: 'Barlow Condensed, sans-serif', background: '#2a1a1a', color: '#f5f0e8', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer' }}>
                    <option value="all">All categories</option>
                    {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <div className="flex items-center gap-1">
                    {YOYO_FILTERS.map((f) => {
                      const active = cov.yoyo === f.key;
                      return (
                        <button key={f.key} onClick={() => updateCov(schemaName, { yoyo: active && f.key !== 'all' ? 'all' : f.key })}
                          style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', background: active ? f.activeBg : 'rgba(255,255,255,0.04)', color: active ? f.text : 'rgba(245,240,232,0.35)', border: `1px solid ${active ? 'transparent' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer' }}>
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                  {availBowlTypes.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {availBowlTypes.map((bt) => {
                        const active = cov.bowlTypes.includes(bt);
                        return (
                          <button key={bt}
                            onClick={() => updateCov(schemaName, { bowlTypes: active ? cov.bowlTypes.filter((x) => x !== bt) : [...cov.bowlTypes, bt] })}
                            style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', background: active ? `${color}33` : 'rgba(255,255,255,0.04)', color: active ? color : 'rgba(245,240,232,0.35)', border: `1px solid ${active ? color + '66' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer' }}>
                            {bt}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.4)', fontFamily: 'Barlow Condensed, sans-serif' }}>min</span>
                    <input type="number" min={0} max={100} step={5} value={cov.threshold}
                      onChange={(e) => updateCov(schemaName, { threshold: Math.max(0, Math.min(100, Number(e.target.value))) })}
                      style={{ width: 46, padding: '2px 4px', borderRadius: 4, fontSize: 12, fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', background: '#2a1a1a', color: '#c8a84b', border: `1px solid ${cov.threshold > 0 ? 'rgba(200,168,75,0.4)' : 'rgba(255,255,255,0.1)'}`, textAlign: 'center' }} />
                    <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.4)', fontFamily: 'Barlow Condensed, sans-serif' }}>%</span>
                  </div>
                  <span style={{ fontSize: 10, color, fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, marginLeft: 2 }}>
                    {visCount}/{totalSkills} skills
                  </span>
                  {isActive && (
                    <button onClick={() => updateCov(schemaName, { category: 'all', yoyo: 'all', threshold: 0, bowlTypes: [] })}
                      style={{ fontSize: 10, color: 'rgba(192,57,43,0.7)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
                      title="Reset this schema's filter">
                      ✕ reset
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {/* Save / load */}
          <div className="flex items-center gap-2 mt-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <input type="text" placeholder="Save filter as…" value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveFilter(); }}
              style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontFamily: 'Barlow Condensed, sans-serif', background: '#2a1a1a', color: '#f5f0e8', border: '1px solid rgba(255,255,255,0.12)', width: 140 }} />
            <button onClick={handleSaveFilter} disabled={!filterName.trim() || filterSaving}
              style={{ padding: '2px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', background: filterName.trim() && !filterSaving ? 'rgba(200,168,75,0.2)' : 'rgba(255,255,255,0.04)', color: filterName.trim() && !filterSaving ? '#c8a84b' : 'rgba(245,240,232,0.2)', border: '1px solid rgba(200,168,75,0.25)', cursor: filterName.trim() && !filterSaving ? 'pointer' : 'not-allowed' }}>
              {filterSaving ? '…' : '💾 Save'}
            </button>
            {savedFilters.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {savedFilters.map((f) => (
                  <div key={f.id} className="flex items-center" style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <button onClick={() => handleLoadFilter(f)}
                      style={{ padding: '2px 8px', fontSize: 10, fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', color: 'rgba(245,240,232,0.7)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      {f.name}
                    </button>
                    <button onClick={() => handleDeleteFilter(f.id)}
                      style={{ padding: '2px 5px', fontSize: 10, color: 'rgba(192,57,43,0.6)', background: 'none', border: 'none', cursor: 'pointer', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
                      title="Delete">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {filteredPlayers.length === 0 ? (
        <div className="py-8 text-center" style={{ color: 'rgba(245,240,232,0.4)', fontFamily: 'Barlow Condensed, sans-serif' }}>No matching players</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              {/* Row 1: Schema headers (colSpan = visibleSkills*2 + visSections + 1 for schema avg) */}
              <tr>
                <th rowSpan={4} onClick={() => togglePivotSort('player', 'asc')} style={{ ...TH_BASE, ...stickyCellStyle(0, PLAYER_W, '#1a1010', 3), textAlign: 'left', color: pivotSortCol === 'player' ? '#c8a84b' : 'rgba(245,240,232,0.6)', cursor: 'pointer', userSelect: 'none' }}>Player{sortIndicator('player')}</th>
                <th rowSpan={4} onClick={() => togglePivotSort('yoyo')} style={{ ...TH_BASE, ...stickyCellStyle(PLAYER_W, YOYO_W, '#1a1010', 3), textAlign: 'center', color: pivotSortCol === 'yoyo' ? '#c8a84b' : 'rgba(245,240,232,0.6)', cursor: 'pointer', userSelect: 'none' }}>Yo-Yo{sortIndicator('yoyo')}</th>
                <th rowSpan={4} onClick={() => togglePivotSort('category', 'asc')} style={{ ...TH_BASE, ...stickyCellStyle(PLAYER_W + YOYO_W, CAT_W, '#1a1010', 3), textAlign: 'left', color: pivotSortCol === 'category' ? '#c8a84b' : 'rgba(245,240,232,0.6)', cursor: 'pointer', userSelect: 'none' }}>Category{sortIndicator('category')}</th>
                <th rowSpan={4} onClick={() => togglePivotSort('div', 'asc')} style={{ ...TH_BASE, ...stickyCellStyle(PLAYER_W + YOYO_W + CAT_W, DIV_W, '#1a1010', 3), textAlign: 'center', color: pivotSortCol === 'div' ? '#c8a84b' : 'rgba(245,240,232,0.6)', cursor: 'pointer', userSelect: 'none', display: showExtraCols ? undefined : 'none' }}>Div{sortIndicator('div')}</th>
                <th rowSpan={4} onClick={() => togglePivotSort('primary-skill', 'asc')} style={{ ...TH_BASE, ...stickyCellStyle(PLAYER_W + YOYO_W + CAT_W + DIV_W, PRIM_W, '#1a1010', 3), textAlign: 'left', color: pivotSortCol === 'primary-skill' ? '#c8a84b' : 'rgba(245,240,232,0.6)', cursor: 'pointer', userSelect: 'none', display: showExtraCols ? undefined : 'none' }}>Skill{sortIndicator('primary-skill')}</th>
                <th rowSpan={4} onClick={() => togglePivotSort('batting-hand', 'asc')} style={{ ...TH_BASE, ...stickyCellStyle(PLAYER_W + YOYO_W + CAT_W + DIV_W + PRIM_W, BAT_HAND_W, '#1a1010', 3), textAlign: 'center', color: pivotSortCol === 'batting-hand' ? '#c8a84b' : 'rgba(245,240,232,0.6)', cursor: 'pointer', userSelect: 'none', display: showExtraCols ? undefined : 'none' }}>Bat{sortIndicator('batting-hand')}</th>
                <th rowSpan={4} onClick={() => togglePivotSort('bowler-arm', 'asc')} style={{ ...TH_BASE, ...stickyCellStyle(PLAYER_W + YOYO_W + CAT_W + DIV_W + PRIM_W + BAT_HAND_W, BOWL_ARM_W, '#1a1010', 3), textAlign: 'center', color: pivotSortCol === 'bowler-arm' ? '#c8a84b' : 'rgba(245,240,232,0.6)', cursor: 'pointer', userSelect: 'none', display: showExtraCols ? undefined : 'none' }}>Arm{sortIndicator('bowler-arm')}</th>
                <th rowSpan={4} onClick={() => togglePivotSort('bowling-type', 'asc')} style={{ ...TH_BASE, ...stickyCellStyle(PLAYER_W + YOYO_W + CAT_W + DIV_W + PRIM_W + BAT_HAND_W + BOWL_ARM_W, BOWL_TYPE_W, '#1a1010', 3), textAlign: 'left', color: pivotSortCol === 'bowling-type' ? '#c8a84b' : 'rgba(245,240,232,0.6)', cursor: 'pointer', userSelect: 'none', display: showExtraCols ? undefined : 'none' }}>Bowl Type{sortIndicator('bowling-type')}</th>
                {visibleSchemas.map(([schemaName, def]) => {
                  const visSecs = getVisibleSections(schemaName, def);
                  const colSpan = visSecs.reduce((s, { visSkills }) => s + visSkills.length * 2 + 1, 0) + 1;
                  const color = SCHEMA_COLORS[schemaName];
                  return (
                    <th key={schemaName} colSpan={colSpan}
                      style={{ ...TH_BASE, textAlign: 'center', color, borderBottom: `2px solid ${color}55`, fontSize: 12, letterSpacing: '0.1em' }}>
                      {schemaName === 'Batsman' ? 'BATSMAN' : schemaName === 'Fast Bowler' ? 'FAST BOWLER' : 'SPIN BOWLER'}
                    </th>
                  );
                })}
                <th rowSpan={4} style={{ ...TH_BASE, textAlign: 'left', minWidth: 200, color: 'rgba(245,240,232,0.6)', paddingLeft: 10 }}>Remarks</th>
              </tr>
              {/* Row 2: Section headers + Schema Avg (rowSpan=3) */}
              <tr>
                {visibleSchemas.map(([schemaName, def]) => (
                  <Fragment key={`hdr2-${schemaName}`}>
                    {getVisibleSections(schemaName, def).map(({ sec, visSkills }) => (
                      <th key={`${schemaName}-${sec.letter}`} colSpan={visSkills.length * 2 + 1}
                        style={{ ...TH_BASE, textAlign: 'center', fontSize: 10, color: 'rgba(245,240,232,0.45)', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                        {sec.letter}: {sec.name}
                      </th>
                    ))}
                    <th rowSpan={3}
                      onClick={() => togglePivotSort(`schema:${schemaName}`)}
                      style={{ ...TH_BASE, textAlign: 'center', width: 46, minWidth: 46, fontSize: 9, fontWeight: 800, color: SCHEMA_COLORS[schemaName], borderLeft: `2px solid ${SCHEMA_COLORS[schemaName]}44`, background: `${SCHEMA_COLORS[schemaName]}0d`, letterSpacing: '0.04em', verticalAlign: 'middle', cursor: 'pointer', userSelect: 'none' }}>
                      Avg{pivotSortCol === `schema:${schemaName}` ? (pivotSortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                    </th>
                  </Fragment>
                ))}
              </tr>
              {/* Row 3: Skill headers + Section Avg (rowSpan=2) */}
              <tr>
                {visibleSchemas.map(([schemaName, def]) =>
                  getVisibleSections(schemaName, def).map(({ sec, visSkills }) => (
                    <Fragment key={`hdr3-${schemaName}-${sec.letter}`}>
                      {visSkills.map((sk) => (
                        <th key={`${schemaName}-${sec.letter}-${sk.name}`} colSpan={2}
                          style={{ ...TH_BASE, textAlign: 'center', fontSize: 9, color: 'rgba(245,240,232,0.45)', borderLeft: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'normal', wordBreak: 'break-word', minWidth: 62, maxWidth: 80, padding: '4px 3px' }}>
                          {sk.name}
                        </th>
                      ))}
                      <th rowSpan={2}
                        onClick={() => togglePivotSort(`sec:${schemaName}|${sec.letter}`)}
                        style={{ ...TH_BASE, textAlign: 'center', width: 40, minWidth: 40, fontSize: 9, fontWeight: 800, color: pivotSortCol === `sec:${schemaName}|${sec.letter}` ? '#c8a84b' : 'rgba(245,240,232,0.5)', borderLeft: '1px solid rgba(255,255,255,0.12)', background: pivotSortCol === `sec:${schemaName}|${sec.letter}` ? 'rgba(200,168,75,0.1)' : 'rgba(255,255,255,0.04)', letterSpacing: '0.04em', verticalAlign: 'middle', cursor: 'pointer', userSelect: 'none' }}>
                        {pivotSortCol === `sec:${schemaName}|${sec.letter}` ? (pivotSortDir === 'desc' ? '↓' : '↑') : 'Sec'}<br />{pivotSortCol === `sec:${schemaName}|${sec.letter}` ? 'Avg' : 'Avg'}
                      </th>
                    </Fragment>
                  ))
                )}
              </tr>
              {/* Row 4: Avg | N (only skill sub-cols; sec/schema avg covered by rowSpan) */}
              <tr>
                {visibleSchemas.map(([schemaName, def]) =>
                  getVisibleSections(schemaName, def).flatMap(({ sec, visSkills }) =>
                    visSkills.map((sk) => (
                      <Fragment key={`${schemaName}-${sec.letter}-${sk.name}-sub`}>
                        <th style={{ ...TH_BASE, textAlign: 'center', width: 36, minWidth: 36, borderLeft: '1px solid rgba(255,255,255,0.07)', fontSize: 9, color: 'rgba(245,240,232,0.35)', padding: '3px 2px' }}>Avg</th>
                        <th style={{ ...TH_BASE, textAlign: 'center', width: 24, minWidth: 24, fontSize: 9, color: 'rgba(245,240,232,0.2)', padding: '3px 2px' }}>N</th>
                      </Fragment>
                    ))
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player, pi) => {
                const yoyo = getYoYoBadge(player.coachEvals, t);
                const catColor = getCategoryColor(player.category);
                const remarkItems = player.coachEvals
                  .filter((e) => (e.remarks || '').trim())
                  .map((e) => ({ coachName: e.coachName || e.coachEmail, remark: e.remarks }));
                const remarks = remarkItems.map((r) => `${r.coachName}: ${r.remark}`).join(' · ');
                const rowBg = pi % 2 === 0 ? '#1a1010' : '#1e1212';

                return (
                  <tr key={player.rowIndex} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {/* Sticky: Player */}
                    <td style={{ ...stickyCellStyle(0, PLAYER_W, rowBg), padding: '5px 8px' }}>
                      <button onClick={() => onRowClick(player)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: 12, color: '#f5f0e8', padding: 0, width: '100%' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#c8a84b'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#f5f0e8'; }}>
                        {player.name}
                      </button>
                    </td>
                    {/* Sticky: Yo-Yo */}
                    <td style={{ ...stickyCellStyle(PLAYER_W, YOYO_W, rowBg), textAlign: 'center', padding: '5px 4px' }}>
                      {yoyo ? (
                        <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: 11, color: yoyo.text, background: yoyo.bg, borderRadius: 4, padding: '2px 5px' }}>
                          {yoyo.best}
                        </span>
                      ) : <span style={{ color: 'rgba(245,240,232,0.2)', fontSize: 10 }}>—</span>}
                    </td>
                    {/* Sticky: Category */}
                    <td style={{ ...stickyCellStyle(PLAYER_W + YOYO_W, CAT_W, rowBg), padding: '5px 6px' }}>
                      <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 10, fontWeight: 700, color: catColor.text, background: catColor.bg, borderRadius: 3, padding: '2px 5px', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {player.category || player.schema}
                      </span>
                    </td>
                    {/* Sticky: Div, Primary Skill, Batting Hand, Bowler Arm, Bowling Type — collapsible */}
                    <td style={{ ...stickyCellStyle(PLAYER_W + YOYO_W + CAT_W, DIV_W, rowBg), textAlign: 'center', padding: '5px 3px', fontFamily: 'Barlow Condensed, sans-serif', fontSize: 10, color: 'rgba(245,240,232,0.7)', display: showExtraCols ? undefined : 'none' }}>
                      {player.div || <span style={{ color: 'rgba(245,240,232,0.2)' }}>—</span>}
                    </td>
                    <td style={{ ...stickyCellStyle(PLAYER_W + YOYO_W + CAT_W + DIV_W, PRIM_W, rowBg), padding: '5px 5px', fontFamily: 'Barlow Condensed, sans-serif', fontSize: 10, color: 'rgba(245,240,232,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: showExtraCols ? undefined : 'none' }}>
                      {player.extraInfo?.['Primary Skill'] || <span style={{ color: 'rgba(245,240,232,0.2)' }}>—</span>}
                    </td>
                    <td style={{ ...stickyCellStyle(PLAYER_W + YOYO_W + CAT_W + DIV_W + PRIM_W, BAT_HAND_W, rowBg), textAlign: 'center', padding: '5px 3px', fontFamily: 'Barlow Condensed, sans-serif', fontSize: 10, color: 'rgba(245,240,232,0.7)', display: showExtraCols ? undefined : 'none' }}>
                      {player.extraInfo?.['Batting hand'] || <span style={{ color: 'rgba(245,240,232,0.2)' }}>—</span>}
                    </td>
                    <td style={{ ...stickyCellStyle(PLAYER_W + YOYO_W + CAT_W + DIV_W + PRIM_W + BAT_HAND_W, BOWL_ARM_W, rowBg), textAlign: 'center', padding: '5px 3px', fontFamily: 'Barlow Condensed, sans-serif', fontSize: 10, color: 'rgba(245,240,232,0.7)', display: showExtraCols ? undefined : 'none' }}>
                      {player.extraInfo?.['Bowler arm'] || <span style={{ color: 'rgba(245,240,232,0.2)' }}>—</span>}
                    </td>
                    <td style={{ ...stickyCellStyle(PLAYER_W + YOYO_W + CAT_W + DIV_W + PRIM_W + BAT_HAND_W + BOWL_ARM_W, BOWL_TYPE_W, rowBg), padding: '5px 5px', fontFamily: 'Barlow Condensed, sans-serif', fontSize: 10, color: 'rgba(245,240,232,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: showExtraCols ? undefined : 'none' }}>
                      {player.extraInfo?.['Bowling type'] || <span style={{ color: 'rgba(245,240,232,0.2)' }}>—</span>}
                    </td>
                    {/* Skill cells + section avg + schema avg (only visible skills/sections/schemas) */}
                    {visibleSchemas.map(([schemaName, def]) => {
                      const visSecs = getVisibleSections(schemaName, def);
                      const schemaAvg = getSchemaAvgVis(player, visSecs);
                      const schemaAvgSc = schemaAvg !== null ? skillScoreColor(schemaAvg) : null;
                      return (
                        <Fragment key={`${player.rowIndex}-${schemaName}`}>
                          {visSecs.map(({ sec, visSkills }) => {
                            const secAvg = getSectionAvgVis(player, visSkills);
                            const secAvgSc = secAvg !== null ? skillScoreColor(secAvg) : null;
                            return (
                              <Fragment key={`${player.rowIndex}-${schemaName}-${sec.letter}`}>
                                {visSkills.map((sk) => {
                                  const stat = getSkillStat(player, sk.name);
                                  if (!stat) {
                                    return (
                                      <Fragment key={`${player.rowIndex}-${schemaName}-${sec.letter}-${sk.name}`}>
                                        <td style={{ textAlign: 'center', padding: '4px 2px', fontSize: 10, color: 'rgba(245,240,232,0.15)', background: rowBg, borderLeft: '1px solid rgba(255,255,255,0.03)' }}>—</td>
                                        <td style={{ background: rowBg }} />
                                      </Fragment>
                                    );
                                  }
                                  const sc = skillScoreColor(stat.avg);
                                  return (
                                    <Fragment key={`${player.rowIndex}-${schemaName}-${sec.letter}-${sk.name}`}>
                                      <td
                                        title={allowCoachBreakdown ? `${player.name} · ${sk.name}: avg ${stat.avg.toFixed(3)} from ${stat.count} coach${stat.count !== 1 ? 'es' : ''}` : `${stat.avg.toFixed(3)} (${stat.count} coach${stat.count !== 1 ? 'es' : ''})`}
                                        style={{
                                          textAlign: 'center', padding: '4px 3px', fontSize: 11, fontWeight: 700,
                                          fontFamily: 'Barlow Condensed, sans-serif',
                                          background: sc.bg, color: sc.color,
                                          cursor: allowCoachBreakdown ? 'pointer' : 'default', borderLeft: '1px solid rgba(255,255,255,0.04)',
                                        }}
                                        onClick={allowCoachBreakdown ? (e) => {
                                          e.stopPropagation();
                                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                          setPopover({
                                            playerName: player.name,
                                            skillName: sk.name,
                                            entries: stat.entries,
                                            x: rect.left,
                                            y: rect.bottom + 6,
                                          });
                                        } : undefined}>
                                        {stat.avg.toFixed(3)}
                                      </td>
                                      <td style={{ textAlign: 'center', padding: '4px 2px', fontSize: 9, color: 'rgba(245,240,232,0.3)', background: rowBg }}>
                                        {stat.count}
                                      </td>
                                    </Fragment>
                                  );
                                })}
                                {/* Section Avg (visible skills only) */}
                                <td style={{
                                  textAlign: 'center', padding: '4px 4px', fontSize: 11, fontWeight: 800,
                                  fontFamily: 'Barlow Condensed, sans-serif',
                                  background: secAvgSc ? secAvgSc.bg : rowBg,
                                  color: secAvgSc ? secAvgSc.color : 'rgba(245,240,232,0.2)',
                                  borderLeft: '1px solid rgba(255,255,255,0.1)',
                                }}>
                                  {secAvg !== null ? secAvg.toFixed(3) : '—'}
                                </td>
                              </Fragment>
                            );
                          })}
                          {/* Schema Avg (visible skills only) */}
                          <td style={{
                            textAlign: 'center', padding: '4px 5px', fontSize: 12, fontWeight: 800,
                            fontFamily: 'Barlow Condensed, sans-serif',
                            background: schemaAvgSc ? schemaAvgSc.bg : rowBg,
                            color: schemaAvgSc ? schemaAvgSc.color : 'rgba(245,240,232,0.2)',
                            borderLeft: `2px solid ${SCHEMA_COLORS[schemaName]}33`,
                          }}>
                            {schemaAvg !== null ? schemaAvg.toFixed(3) : '—'}
                          </td>
                        </Fragment>
                      );
                    })}
                    {/* Remarks — truncated, click to expand */}
                    <td
                      style={{ padding: '5px 10px', fontSize: 11, color: remarkItems.length ? 'rgba(245,240,232,0.6)' : 'rgba(245,240,232,0.2)', background: rowBg, maxWidth: 220, cursor: remarkItems.length ? 'pointer' : 'default' }}
                      onClick={(e) => {
                        if (!remarkItems.length) return;
                        e.stopPropagation();
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setPopover(null);
                        setRemarksPopover({ playerName: player.name, items: remarkItems, x: rect.left, y: rect.bottom + 6 });
                      }}
                      onMouseEnter={(e) => { if (remarkItems.length) (e.currentTarget as HTMLElement).style.color = '#c8a84b'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = remarkItems.length ? 'rgba(245,240,232,0.6)' : 'rgba(245,240,232,0.2)'; }}>
                      {remarkItems.length ? (
                        <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
                          {remarks}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Score popover */}
      {popover && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: Math.min(popover.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 230),
            top: Math.min(popover.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 220),
            zIndex: 1000,
            background: '#1a1010',
            border: '1px solid rgba(192,57,43,0.4)',
            borderRadius: 8,
            padding: '12px 14px',
            minWidth: 200,
            boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
          }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: 13, color: '#c8a84b', marginBottom: 2 }}>
            {popover.playerName}
          </div>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 11, color: 'rgba(245,240,232,0.45)', marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8 }}>
            {popover.skillName}
          </div>
          {popover.entries.map((entry, i) => {
            const sc = skillScoreColor(entry.score);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 5 }}>
                <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 12, color: 'rgba(245,240,232,0.75)', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.coachName}
                </span>
                <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: 12, color: sc.color, whiteSpace: 'nowrap' }}>
                  {'★'.repeat(entry.score)}{'☆'.repeat(Math.max(0, 5 - entry.score))} {entry.score}/5
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Remarks popover */}
      {remarksPopover && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: Math.min(remarksPopover.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 320),
            top: Math.min(remarksPopover.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 260),
            zIndex: 1000,
            background: '#1a1010',
            border: '1px solid rgba(200,168,75,0.35)',
            borderRadius: 8,
            padding: '12px 14px',
            minWidth: 280,
            maxWidth: 340,
            boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
          }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: 13, color: '#c8a84b', marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8 }}>
            {remarksPopover.playerName} — Remarks
          </div>
          {remarksPopover.items.map((item, i) => (
            <div key={i} style={{ marginBottom: i < remarksPopover.items.length - 1 ? 10 : 0 }}>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 11, fontWeight: 700, color: 'rgba(245,240,232,0.5)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {item.coachName}
              </div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 12, color: 'rgba(245,240,232,0.85)', lineHeight: 1.5 }}>
                {item.remark}
              </div>
            </div>
          ))}
        </div>
      )}
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

// ── Yo-Yo Config Panel (admin settings) ──────────────────────────────

function YoyoConfigPanel({
  sheetKey,
  thresholds,
  onSave,
}: {
  sheetKey: string;
  thresholds: YoyoThresholds;
  onSave: (t: YoyoThresholds) => void;
}) {
  const [greenMin, setGreenMin] = useState(String(thresholds.greenMin));
  const [amberMin, setAmberMin] = useState(String(thresholds.amberMin));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const g = parseFloat(greenMin);
  const a = parseFloat(amberMin);
  const valid = !isNaN(g) && !isNaN(a) && g > a && a > 0;

  async function handleSave() {
    if (!valid) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/scout/yoyo-config?sheetKey=${encodeURIComponent(sheetKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ greenMin: g, amberMin: a }),
      });
      if (res.ok) {
        onSave({ greenMin: g, amberMin: a });
        setMsg({ text: 'Saved successfully', ok: true });
      } else {
        const data = await res.json();
        setMsg({ text: data.error || 'Failed to save', ok: false });
      }
    } catch {
      setMsg({ text: 'Network error', ok: false });
    } finally {
      setSaving(false);
    }
  }

  const INPUT_STYLE: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 4, color: '#f5f0e8', padding: '5px 10px', width: 90,
    fontFamily: 'Barlow Condensed, sans-serif', fontSize: 14, fontWeight: 700,
    textAlign: 'center',
  };

  const preview = [
    { label: 'Green', min: g, color: '#a5d6a7', bg: 'rgba(27,94,32,0.35)' },
    { label: 'Amber', min: a, max: g, color: '#ffcc80', bg: 'rgba(127,63,0,0.35)' },
    { label: 'Red', max: a, color: '#ef9a9a', bg: 'rgba(127,31,31,0.35)' },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-6 pb-3 border-b" style={{ borderColor: 'rgba(192,57,43,0.2)' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef9a9a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#ef9a9a', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em' }}>
          Admin — Settings
        </span>
      </div>

      <div className="flex flex-col gap-6" style={{ maxWidth: 480 }}>
        <div className="rounded-lg border p-5" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(192,57,43,0.2)' }}>
          <p className="text-sm font-bold mb-4 uppercase tracking-wider" style={{ color: '#f5f0e8', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.08em' }}>
            Yo-Yo Test Thresholds
          </p>

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold w-28 uppercase" style={{ color: '#a5d6a7', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.06em' }}>Green (≥)</span>
              <input
                type="number" step="0.1" min="0" max="25"
                value={greenMin}
                onChange={(e) => setGreenMin(e.target.value)}
                style={INPUT_STYLE}
              />
              <span className="text-xs" style={{ color: 'rgba(245,240,232,0.35)', fontFamily: 'Barlow Condensed, sans-serif' }}>score qualifies as Green</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold w-28 uppercase" style={{ color: '#ffcc80', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.06em' }}>Amber (≥)</span>
              <input
                type="number" step="0.1" min="0" max="25"
                value={amberMin}
                onChange={(e) => setAmberMin(e.target.value)}
                style={INPUT_STYLE}
              />
              <span className="text-xs" style={{ color: 'rgba(245,240,232,0.35)', fontFamily: 'Barlow Condensed, sans-serif' }}>score qualifies as Amber</span>
            </div>
          </div>

          {!valid && (greenMin || amberMin) && (
            <p className="text-xs mt-3" style={{ color: '#ef9a9a', fontFamily: 'Barlow Condensed, sans-serif' }}>
              Green must be greater than Amber, and both must be positive numbers.
            </p>
          )}

          {/* Live preview */}
          {valid && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <p className="text-[10px] font-bold uppercase mb-2" style={{ color: 'rgba(245,240,232,0.35)', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.08em' }}>Preview</p>
              <div className="flex gap-2">
                {preview.map((p) => (
                  <span key={p.label} className="px-2 py-1 rounded text-xs font-bold" style={{ background: p.bg, color: p.color, fontFamily: 'Barlow Condensed, sans-serif' }}>
                    {p.label}: {p.min !== undefined ? `≥ ${p.min}` : `< ${p.max}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={handleSave}
              disabled={!valid || saving}
              style={{
                padding: '6px 18px', borderRadius: 4, fontSize: 12, fontWeight: 800,
                fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.08em',
                background: valid && !saving ? '#c0392b' : 'rgba(192,57,43,0.3)',
                color: valid && !saving ? '#f5f0e8' : 'rgba(245,240,232,0.35)',
                border: 'none', cursor: valid && !saving ? 'pointer' : 'not-allowed',
                textTransform: 'uppercase',
              }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            {msg && (
              <span className="text-xs font-bold" style={{ color: msg.ok ? '#a5d6a7' : '#ef9a9a', fontFamily: 'Barlow Condensed, sans-serif' }}>
                {msg.text}
              </span>
            )}
          </div>
        </div>
      </div>
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
  const [viewMode, setViewMode] = useState<'board' | 'my-evals' | 'my-eval-details' | 'my-skill-details' | 'all-fitness' | 'selection' | 'team-packages' | 'skill-pivot' | 'admin-evals' | 'admin-skill-details' | 'admin-agg-skills' | 'admin-team-packages' | 'admin-pivot' | 'admin-settings'>('board');
  const [isAdmin, setIsAdmin] = useState(false);
  const [yoyoThresholds, setYoyoThresholds] = useState<YoyoThresholds>(DEFAULT_YOYO_THRESHOLDS);
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
    Promise.all([
      fetch(`/api/scout?sheetKey=${encodeURIComponent(sheetKey)}`).then((r) => r.json()),
      fetch(`/api/scout/yoyo-config?sheetKey=${encodeURIComponent(sheetKey)}`).then((r) => r.json()).catch(() => DEFAULT_YOYO_THRESHOLDS),
    ]).then(([data, cfg]) => {
      if (data.error === 'unauthorized' || data.status === 403) { setUnauthorized(true); return; }
      if (data.error) setError(data.error);
      else { setPlayers(data.players || []); setIsAdmin(!!data.isAdmin); }
      if (cfg && typeof cfg.greenMin === 'number') setYoyoThresholds(cfg);
    }).catch(() => setError('Failed to load player data.'))
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
    <YoyoThresholdsCtx.Provider value={yoyoThresholds}>
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
                    { label: 'Skill Pivot', mode: 'skill-pivot' },
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
                        { label: 'Skill Pivot', mode: 'admin-pivot' },
                        { label: 'All Packages', mode: 'admin-team-packages' },
                        { label: 'Settings', mode: 'admin-settings' },
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

          {/* Reports: Skill Pivot (all coaches) */}
          {!loading && !error && viewMode === 'skill-pivot' && (
            <AdminPivotTable players={players} onRowClick={setActivePlayer} sheetKey={sheetKey} />
          )}

          {/* Admin: Skill Pivot table */}
          {!loading && !error && viewMode === 'admin-pivot' && isAdmin && (
            <>
              <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: 'rgba(192,57,43,0.2)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef9a9a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#ef9a9a', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em' }}>
                  Admin Report — Skill Pivot (Schema → Section → Skill Averages)
                </span>
              </div>
              <AdminPivotTable players={players} onRowClick={setActivePlayer} sheetKey={sheetKey} allowCoachBreakdown />
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

          {/* Admin: Settings */}
          {!loading && !error && viewMode === 'admin-settings' && isAdmin && (
            <YoyoConfigPanel
              sheetKey={sheetKey}
              thresholds={yoyoThresholds}
              onSave={setYoyoThresholds}
            />
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
    </YoyoThresholdsCtx.Provider>
  );
}
