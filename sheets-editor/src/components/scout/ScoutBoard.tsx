'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import type { ScoutPlayer, PlayerEvaluation, SchemaType } from '@/types/scout';
import type { AppUser } from '@/types';
import { SCHEMAS, calcScore, getRating, playerInitials } from '@/lib/scout-schemas';
import { PlayerModal } from './PlayerModal';

interface ScoutBoardProps {
  sheetKey: string;
  user: AppUser;
}

interface BatchGroup {
  name: string;
  players: ScoutPlayer[];
}

function groupByBatch(players: ScoutPlayer[]): BatchGroup[] {
  const map = new Map<string, ScoutPlayer[]>();
  for (const p of players) {
    const key = p.batch || 'Unassigned';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return Array.from(map.entries()).map(([name, ps]) => ({ name, players: ps }));
}

function isEvaluated(player: ScoutPlayer): boolean {
  return Object.values(player.evaluation.skills).some((v) => v > 0);
}

// Avatar background color keyed by role within the category string
function getCategoryColor(category: string): { bg: string; text: string } {
  const c = category.toLowerCase();
  if (c.includes('wicket') || c.includes('keeper') || c.includes('wk'))
    return { bg: '#00695c', text: '#fff' };          // teal
  if (c.includes('allrounder') || c.includes('all-rounder') || c.includes('all rounder'))
    return { bg: '#6a1b9a', text: '#fff' };          // purple
  if (c.includes('batter') || c.includes('batsman'))
    return { bg: '#1565c0', text: '#fff' };          // blue
  if (c.includes('bowler'))
    return { bg: '#bf360c', text: '#fff' };          // deep orange
  return { bg: '#2e4030', text: '#f5f0e8' };         // default green
}

function PinIcon({ pinned }: { pinned: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill={pinned ? '#c8a84b' : 'none'}
      stroke={pinned ? '#c8a84b' : 'rgba(100,100,100,0.7)'}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
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
}: {
  player: ScoutPlayer;
  onClick: () => void;
  isPinned: boolean;
  onTogglePin: (rowIndex: number) => void;
}) {
  const evaluated = isEvaluated(player);
  const schema = SCHEMAS[player.schema as SchemaType];
  const { pct } = evaluated && schema ? calcScore(player.evaluation, schema) : { pct: 0 };
  const catColor = getCategoryColor(player.category);

  return (
    <button
      onClick={onClick}
      className="relative overflow-hidden rounded-lg text-center cursor-pointer border-2 transition-all duration-150"
      style={{
        background: '#f5f0e8',
        borderColor: isPinned ? '#c8a84b' : 'transparent',
        padding: '16px 10px 12px',
        fontFamily: 'Barlow, sans-serif',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#c8a84b';
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = isPinned ? '#c8a84b' : 'transparent';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Decorative circle */}
      <span
        className="absolute -top-4 -right-4 w-12 h-12 rounded-full pointer-events-none"
        style={{ background: 'rgba(192,57,43,0.06)' }}
      />

      {/* Pin button */}
      <span
        className="absolute top-1.5 left-1.5 p-1 rounded transition-opacity"
        style={{ opacity: isPinned ? 1 : 0.3 }}
        title={isPinned ? 'Unpin player' : 'Pin player'}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin(player.rowIndex);
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = isPinned ? '1' : '0.3'; }}
      >
        <PinIcon pinned={isPinned} />
      </span>

      {/* Avatar — color-coded by category */}
      <div
        className="w-11 h-11 rounded-full mx-auto mb-2 flex items-center justify-center text-base font-bold"
        style={{ background: catColor.bg, color: catColor.text, fontFamily: 'Barlow Condensed, sans-serif' }}
      >
        {playerInitials(player.name)}
      </div>

      {/* Name */}
      <div
        className="text-sm font-bold uppercase tracking-tight leading-tight"
        style={{ color: '#1a1a1a', fontFamily: 'Barlow Condensed, sans-serif' }}
      >
        {player.name}
      </div>

      {/* Category + Schema — colored dot prefix */}
      <div className="flex items-center justify-center gap-1 mt-0.5">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: catColor.bg }} />
        <span className="text-xs truncate opacity-55" style={{ color: '#4a4a4a' }}>
          {player.category ? `${player.category} · ${player.schema}` : player.schema}
        </span>
      </div>

      {/* Score badge */}
      <span
        className="inline-block mt-1.5 text-xs font-bold px-2 py-0.5 rounded-full"
        style={{
          fontFamily: 'Barlow Condensed, sans-serif',
          background: evaluated ? '#1a2e1a' : '#e8e0d0',
          color: evaluated ? '#f5f0e8' : '#4a4a4a',
        }}
      >
        {evaluated ? `${pct}%` : 'Not scored'}
      </span>
    </button>
  );
}

function SectionHeader({
  label,
  count,
  icon,
}: {
  label: string;
  count: number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span
        className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 border rounded-sm flex-shrink-0"
        style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#c8a84b', borderColor: '#c8a84b' }}
      >
        {count} Players
      </span>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <h2
        className="text-2xl font-extrabold uppercase tracking-tight flex-shrink-0"
        style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#f5f0e8' }}
      >
        {label}
      </h2>
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, #2e4030, transparent)' }} />
    </div>
  );
}

function PlayerGrid({
  players,
  pinnedIds,
  onCardClick,
  onTogglePin,
}: {
  players: ScoutPlayer[];
  pinnedIds: Set<number>;
  onCardClick: (p: ScoutPlayer) => void;
  onTogglePin: (rowIndex: number) => void;
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
        />
      ))}
    </div>
  );
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className="fixed bottom-6 left-1/2 z-50 px-5 py-2.5 rounded-lg border-l-4 text-sm font-semibold tracking-wide pointer-events-none"
      style={{
        transform: 'translateX(-50%)',
        background: '#1a2e1a',
        color: '#f5f0e8',
        borderColor: '#c8a84b',
        fontFamily: 'Barlow Condensed, sans-serif',
        animation: 'slideUp 0.3s ease',
        whiteSpace: 'nowrap',
      }}
    >
      {message}
    </div>
  );
}

export function ScoutBoard({ sheetKey, user }: ScoutBoardProps) {
  const router = useRouter();
  const PINNED_KEY = `scout_pinned_${sheetKey}`;

  const [players, setPlayers] = useState<ScoutPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePlayer, setActivePlayer] = useState<ScoutPlayer | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pinnedIds, setPinnedIds] = useState<Set<number>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem(`scout_pinned_${sheetKey}`);
      return stored ? new Set<number>(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    setLoading(true);
    fetch(`/api/scout?sheetKey=${encodeURIComponent(sheetKey)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setPlayers(data.players || []);
      })
      .catch(() => setError('Failed to load player data.'))
      .finally(() => setLoading(false));
  }, [sheetKey]);

  const togglePin = useCallback(
    (rowIndex: number) => {
      setPinnedIds((prev) => {
        const next = new Set(prev);
        if (next.has(rowIndex)) next.delete(rowIndex);
        else next.add(rowIndex);
        try { localStorage.setItem(PINNED_KEY, JSON.stringify(Array.from(next))); } catch {}
        return next;
      });
    },
    [PINNED_KEY]
  );

  const filteredPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return players;
    return players.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.batch.toLowerCase().includes(q) ||
        p.schema.toLowerCase().includes(q)
    );
  }, [players, searchQuery]);

  const pinnedPlayers = useMemo(
    () => filteredPlayers.filter((p) => pinnedIds.has(p.rowIndex)),
    [filteredPlayers, pinnedIds]
  );

  const batches = useMemo(() => groupByBatch(filteredPlayers), [filteredPlayers]);

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
          `/api/scout/update?sheetKey=${encodeURIComponent(sheetKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rowIndex: activePlayer.rowIndex,
              evaluation,
              score: weighted,
              pct,
              rating: ratingLabel,
              remarks,
            }),
          }
        );

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Save failed');
        }

        setPlayers((prev) =>
          prev.map((p) =>
            p.rowIndex === activePlayer.rowIndex
              ? { ...p, evaluation, score: weighted, pct, rating: ratingLabel, remarks }
              : p
          )
        );
        setActivePlayer(null);
        setToast(`${activePlayer.name} saved ✓`);
      } catch (e: any) {
        setToast(`Error: ${e.message}`);
      } finally {
        setSaving(false);
      }
    },
    [activePlayer, sheetKey]
  );

  const totalEvaluated = players.filter(isEvaluated).length;
  const hasSearch = searchQuery.trim().length > 0;
  const noResults = hasSearch && filteredPlayers.length === 0;

  return (
    <>
      <style>{`
        @keyframes slideUp { from { transform: translateX(-50%) translateY(20px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }
        .search-input::placeholder { color: rgba(245,240,232,0.3); }
        .search-input:focus { outline: none; border-color: rgba(200,168,75,0.6); }
      `}</style>

      <div style={{ background: '#1a2e1a', minHeight: '100vh', fontFamily: 'Barlow, sans-serif' }}>

        {/* ── Header ── */}
        <header
          className="sticky top-0 z-10 border-b-2"
          style={{ background: '#243324', borderColor: '#c8a84b' }}
        >
          {/* Top row */}
          <div className="flex items-center gap-3 px-5 md:px-7 py-3">
            {/* Ball icon */}
            <div
              className="w-7 h-7 rounded-full flex-shrink-0 relative"
              style={{ background: '#c0392b', boxShadow: 'inset -3px -3px 0 rgba(0,0,0,0.2)' }}
            >
              <span
                className="absolute"
                style={{
                  top: '50%', left: '10%', width: '80%', height: '2px',
                  background: 'rgba(255,255,255,0.3)',
                  transform: 'translateY(-50%) rotate(-20deg)', borderRadius: '2px',
                }}
              />
            </div>

            <h1
              className="text-lg font-extrabold uppercase tracking-wider flex-shrink-0"
              style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#f5f0e8' }}
            >
              Scout<span style={{ color: '#c8a84b' }}>Board</span>
            </h1>

            {/* Search bar — grows to fill space */}
            <div className="flex-1 mx-3 md:mx-6 relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'rgba(245,240,232,0.35)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="text"
                className="search-input w-full pl-8 pr-3 py-1.5 rounded-md text-sm border transition-colors"
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  color: '#f5f0e8',
                  borderColor: 'rgba(245,240,232,0.15)',
                  fontFamily: 'Barlow, sans-serif',
                }}
                placeholder="Search players…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="absolute right-2.5 top-1/2 -translate-y-1/2"
                  style={{ color: 'rgba(245,240,232,0.4)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {!loading && players.length > 0 && (
                <span
                  className="text-xs hidden lg:block"
                  style={{ color: 'rgba(245,240,232,0.4)', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}
                >
                  {totalEvaluated}/{players.length} rated
                </span>
              )}
              {pinnedIds.size > 0 && (
                <span
                  className="text-xs hidden md:block"
                  style={{ color: 'rgba(200,168,75,0.7)', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}
                >
                  {pinnedIds.size} pinned
                </span>
              )}
              {user.image && (
                <img src={user.image} alt={user.name} className="w-7 h-7 rounded-full hidden sm:block" />
              )}
              <button
                onClick={() => router.push('/dashboard')}
                className="text-xs px-2.5 py-1.5 rounded border transition-opacity hover:opacity-80 hidden sm:block"
                style={{
                  fontFamily: 'Barlow Condensed, sans-serif', color: '#f5f0e8',
                  borderColor: 'rgba(245,240,232,0.2)', background: 'transparent',
                  letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700,
                }}
              >
                Schedule
              </button>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="text-xs px-2.5 py-1.5 rounded transition-opacity hover:opacity-80"
                style={{
                  fontFamily: 'Barlow Condensed, sans-serif', color: 'rgba(245,240,232,0.5)',
                  background: 'transparent', border: 'none',
                  letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700,
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        {/* ── Main content ── */}
        <main className="px-5 md:px-7 py-7 pb-16 mx-auto" style={{ maxWidth: '1200px' }}>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-24">
              <div
                className="w-10 h-10 rounded-full border-2 animate-spin"
                style={{ borderColor: '#c8a84b', borderTopColor: 'transparent' }}
              />
              <span className="ml-4 text-sm" style={{ color: 'rgba(245,240,232,0.5)', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.08em' }}>
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
                  <li>Add player rows — Schema must be "Batsman", "Fast Bowler", or "Spin Bowler"</li>
                </ol>
              </div>
            </div>
          )}

          {/* Empty sheet */}
          {!loading && !error && players.length === 0 && (
            <div className="rounded-lg border p-8 text-center mt-4" style={{ background: '#243324', borderColor: 'rgba(200,168,75,0.2)' }}>
              <p className="text-lg font-bold mb-1" style={{ color: '#f5f0e8', fontFamily: 'Barlow Condensed, sans-serif' }}>
                No players found
              </p>
              <p className="text-sm" style={{ color: 'rgba(245,240,232,0.5)' }}>
                Add player rows to your Google Sheet with <code className="text-[#c8a84b]">Batch</code>, <code className="text-[#c8a84b]">Name</code>, <code className="text-[#c8a84b]">Category</code>, and <code className="text-[#c8a84b]">Schema</code> columns.
              </p>
            </div>
          )}

          {/* No search results */}
          {!loading && !error && noResults && (
            <div className="rounded-lg border p-6 text-center mt-4" style={{ background: '#243324', borderColor: 'rgba(200,168,75,0.15)' }}>
              <p className="font-bold text-base mb-1" style={{ color: '#f5f0e8', fontFamily: 'Barlow Condensed, sans-serif' }}>
                No players match "{searchQuery}"
              </p>
              <button
                className="text-sm mt-1 hover:opacity-80"
                style={{ color: '#c8a84b', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif' }}
                onClick={() => setSearchQuery('')}
              >
                Clear search
              </button>
            </div>
          )}

          {!loading && !error && !noResults && (
            <>
              {/* ── Pinned section ── */}
              {pinnedPlayers.length > 0 && (
                <section className="mb-9">
                  <SectionHeader
                    label="Pinned"
                    count={pinnedPlayers.length}
                    icon={
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#c8a84b" stroke="#c8a84b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
                  />
                </section>
              )}

              {/* ── Batch sections ── */}
              {batches.map((batch) => (
                <section key={batch.name} className="mb-9">
                  <SectionHeader label={batch.name} count={batch.players.length} />
                  <PlayerGrid
                    players={batch.players}
                    pinnedIds={pinnedIds}
                    onCardClick={setActivePlayer}
                    onTogglePin={togglePin}
                  />
                </section>
              ))}
            </>
          )}
        </main>
      </div>

      {/* Modal */}
      {activePlayer && (
        <PlayerModal
          player={activePlayer}
          onClose={() => setActivePlayer(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}
