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
  return Object.values(player.evaluation.skills).some((v) => v > 0);
}

function PlayerCard({
  player,
  onClick,
}: {
  player: ScoutPlayer;
  onClick: () => void;
}) {
  const evaluated = isEvaluated(player);
  const schema = SCHEMAS[player.schema as SchemaType];
  const { pct } = evaluated && schema
    ? calcScore(player.evaluation, schema)
    : { pct: 0 };

  return (
    <button
      onClick={onClick}
      className="relative overflow-hidden rounded-lg text-center cursor-pointer border-2 transition-all duration-150 group"
      style={{
        background: '#f5f0e8',
        borderColor: 'transparent',
        padding: '16px 10px 12px',
        fontFamily: 'Barlow, sans-serif',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#c8a84b';
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'transparent';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Decorative circle */}
      <span
        className="absolute -top-4 -right-4 w-12 h-12 rounded-full pointer-events-none"
        style={{ background: 'rgba(192,57,43,0.06)' }}
      />
      {/* Avatar */}
      <div
        className="w-11 h-11 rounded-full mx-auto mb-2 flex items-center justify-center text-base font-bold"
        style={{
          background: '#2e4030',
          color: '#f5f0e8',
          fontFamily: 'Barlow Condensed, sans-serif',
        }}
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
      {/* Schema label */}
      <div className="text-xs mt-0.5 opacity-50" style={{ color: '#4a4a4a' }}>
        {player.schema}
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
  const [players, setPlayers] = useState<ScoutPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePlayer, setActivePlayer] = useState<ScoutPlayer | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/scout?sheetKey=${encodeURIComponent(sheetKey)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setPlayers(data.players || []);
        }
      })
      .catch(() => setError('Failed to load player data.'))
      .finally(() => setLoading(false));
  }, [sheetKey]);

  const categories = useMemo(() => groupByCategory(players), [players]);

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

  return (
    <>
      <style>{`
        @keyframes slideUp { from { transform: translateX(-50%) translateY(20px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }
      `}</style>

      <div style={{ background: '#1a2e1a', minHeight: '100vh', fontFamily: 'Barlow, sans-serif' }}>

        {/* Header */}
        <header
          className="sticky top-0 z-10 flex items-center gap-3.5 px-7 py-4 border-b-2"
          style={{ background: '#243324', borderColor: '#c8a84b' }}
        >
          {/* Cricket ball icon */}
          <div
            className="w-8 h-8 rounded-full flex-shrink-0 relative"
            style={{
              background: '#c0392b',
              boxShadow: 'inset -3px -3px 0 rgba(0,0,0,0.2)',
            }}
          >
            <span
              className="absolute"
              style={{
                top: '50%',
                left: '10%',
                width: '80%',
                height: '2px',
                background: 'rgba(255,255,255,0.3)',
                transform: 'translateY(-50%) rotate(-20deg)',
                borderRadius: '2px',
              }}
            />
          </div>

          <h1
            className="text-xl font-extrabold uppercase tracking-wider"
            style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#f5f0e8' }}
          >
            Scout<span style={{ color: '#c8a84b' }}>Board</span>
          </h1>

          <div className="hidden sm:flex items-center gap-2 ml-2">
            <span
              className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 border rounded"
              style={{
                fontFamily: 'Barlow Condensed, sans-serif',
                color: '#c8a84b',
                borderColor: 'rgba(200,168,75,0.4)',
              }}
            >
              Cricket Tryouts
            </span>
          </div>

          <div className="ml-auto flex items-center gap-4">
            {!loading && players.length > 0 && (
              <span
                className="text-xs hidden md:block"
                style={{ color: 'rgba(245,240,232,0.45)', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em' }}
              >
                {totalEvaluated} / {players.length} evaluated
              </span>
            )}
            <div className="flex items-center gap-2">
              {user.image && (
                <img src={user.image} alt={user.name} className="w-7 h-7 rounded-full" />
              )}
              <span className="text-xs hidden sm:block" style={{ color: 'rgba(245,240,232,0.5)' }}>
                {user.name}
              </span>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-xs px-3 py-1.5 rounded border transition-opacity hover:opacity-80"
              style={{
                fontFamily: 'Barlow Condensed, sans-serif',
                color: '#f5f0e8',
                borderColor: 'rgba(245,240,232,0.2)',
                background: 'transparent',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              Schedule
            </button>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-xs px-3 py-1.5 rounded transition-opacity hover:opacity-80"
              style={{
                fontFamily: 'Barlow Condensed, sans-serif',
                color: 'rgba(245,240,232,0.5)',
                background: 'transparent',
                border: 'none',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Main content */}
        <main className="px-7 py-7 pb-16 mx-auto" style={{ maxWidth: '1200px' }}>

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

          {error && !loading && (
            <div
              className="rounded-lg border p-6 mt-4"
              style={{ background: '#243324', borderColor: 'rgba(192,57,43,0.4)' }}
            >
              <p className="font-bold mb-2" style={{ color: '#f5f0e8', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1rem' }}>
                Could not load player data
              </p>
              <p className="text-sm mb-4" style={{ color: 'rgba(245,240,232,0.6)' }}>{error}</p>
              <div className="text-sm" style={{ color: 'rgba(245,240,232,0.5)' }}>
                <p className="font-semibold mb-1" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>Setup checklist:</p>
                <ol className="list-decimal ml-5 space-y-1">
                  <li>Add a <code className="text-[#c8a84b]">"tryout"</code> entry to <code className="text-[#c8a84b]">sheets-config.json</code> with your Google Sheet ID</li>
                  <li>Create a tab named <code className="text-[#c8a84b]">Players</code> in your spreadsheet</li>
                  <li>Add headers: <code className="text-[#c8a84b]">Name, Category, Schema, Score, Pct, Rating, Remarks, Evaluation</code></li>
                  <li>Add player rows with Name, Category (e.g. "Batsmen"), and Schema ("Batsman" / "Fast Bowler" / "Spin Bowler")</li>
                </ol>
              </div>
            </div>
          )}

          {!loading && !error && players.length === 0 && (
            <div
              className="rounded-lg border p-8 text-center mt-4"
              style={{ background: '#243324', borderColor: 'rgba(200,168,75,0.2)' }}
            >
              <p className="text-lg font-bold mb-1" style={{ color: '#f5f0e8', fontFamily: 'Barlow Condensed, sans-serif' }}>
                No players found
              </p>
              <p className="text-sm" style={{ color: 'rgba(245,240,232,0.5)' }}>
                Add player rows to your Google Sheet. Each row needs a <code className="text-[#c8a84b]">Name</code>, <code className="text-[#c8a84b]">Category</code>, and <code className="text-[#c8a84b]">Schema</code> column.
              </p>
            </div>
          )}

          {!loading && !error && categories.map((cat) => (
            <section key={cat.name} className="mb-9">
              {/* Category header */}
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 border rounded-sm flex-shrink-0"
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    color: '#c8a84b',
                    borderColor: '#c8a84b',
                  }}
                >
                  {cat.players.length} Players
                </span>
                <h2
                  className="text-2xl font-extrabold uppercase tracking-tight flex-shrink-0"
                  style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#f5f0e8' }}
                >
                  {cat.name}
                </h2>
                <div
                  className="flex-1 h-px"
                  style={{ background: 'linear-gradient(to right, #2e4030, transparent)' }}
                />
              </div>

              {/* Player grid */}
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(138px, 1fr))' }}>
                {cat.players.map((p) => (
                  <PlayerCard
                    key={p.rowIndex}
                    player={p}
                    onClick={() => setActivePlayer(p)}
                  />
                ))}
              </div>
            </section>
          ))}
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
