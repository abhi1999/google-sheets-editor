'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ScoutPlayer, TeamPackage, InGameRatingRecord, InGameRatingPayload } from '@/types/scout';
import type { AppUser } from '@/types';
import { GAME_NUMBERS } from '@/lib/ingame-schemas';
import { playerInitials } from '@/lib/scout-schemas';
import { getQueue, enqueueRating, removeFromQueue, markQueueError } from '@/lib/offline-ratings-queue';
import { TEAM_COLORS } from './TeamSelectionBoard';
import { InGameRatingModal } from './InGameRatingModal';

const FONT = 'Barlow Condensed, sans-serif';

// Retrying won't fix a bad payload or an auth rejection — only queue transient failures.
function isRetryable(status: number): boolean {
  return status !== 400 && status !== 401 && status !== 403;
}

export function GameRatingBoard({
  players,
  user,
  sheetKey,
}: {
  players: ScoutPlayer[];
  user: AppUser;
  sheetKey: string;
}) {
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState<TeamPackage | null>(null);
  const [selectedGame, setSelectedGame] = useState<number>(1);
  const [selectedTeamIndex, setSelectedTeamIndex] = useState<number>(1);
  const [ratings, setRatings] = useState<InGameRatingRecord[]>([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [activePlayer, setActivePlayer] = useState<ScoutPlayer | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/scout/approved-roster?sheetKey=${encodeURIComponent(sheetKey)}`);
        const data = await res.json();
        setApproved(data.approved || null);
      } catch {}
      setLoading(false);
    })();
  }, [sheetKey]);

  const fetchRatings = useCallback(async () => {
    setRatingsLoading(true);
    try {
      const res = await fetch(`/api/scout/in-game-ratings?sheetKey=${encodeURIComponent(sheetKey)}&gameNumber=${selectedGame}`);
      const data = await res.json();
      setRatings(data.ratings || []);
    } catch {}
    setRatingsLoading(false);
  }, [sheetKey, selectedGame]);

  useEffect(() => { fetchRatings(); }, [fetchRatings]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const refreshPendingCount = useCallback(() => {
    setPendingCount(getQueue(sheetKey).length);
  }, [sheetKey]);

  useEffect(() => { refreshPendingCount(); }, [refreshPendingCount]);

  // Flushes queued offline ratings sequentially, stopping early on the first
  // transient failure (no point hammering the rest of the queue immediately).
  const flushQueue = useCallback(async () => {
    const queue = getQueue(sheetKey);
    if (queue.length === 0) return;
    for (const item of queue) {
      try {
        const res = await fetch(`/api/scout/in-game-ratings?sheetKey=${encodeURIComponent(sheetKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload),
        });
        if (res.ok) {
          removeFromQueue(sheetKey, item.clientId);
        } else if (isRetryable(res.status)) {
          markQueueError(sheetKey, item.clientId, `HTTP ${res.status}`);
          break;
        } else {
          // Server will never accept this payload — drop it rather than retry forever.
          removeFromQueue(sheetKey, item.clientId);
          setToast('A queued rating could not be saved and was dropped — please re-enter it');
        }
      } catch {
        markQueueError(sheetKey, item.clientId, 'Network error');
        break;
      }
    }
    refreshPendingCount();
    fetchRatings();
  }, [sheetKey, refreshPendingCount, fetchRatings]);

  useEffect(() => {
    flushQueue();
    window.addEventListener('online', flushQueue);
    return () => window.removeEventListener('online', flushQueue);
  }, [flushQueue]);

  useEffect(() => {
    if (pendingCount === 0) return;
    const interval = setInterval(flushQueue, 30000);
    return () => clearInterval(interval);
  }, [pendingCount, flushQueue]);

  const selectedTeam = useMemo(
    () => approved?.teams.find((t) => t.teamIndex === selectedTeamIndex) || null,
    [approved, selectedTeamIndex]
  );

  const rosterPlayers = useMemo(() => {
    if (!selectedTeam) return [];
    return selectedTeam.slots
      .filter((s) => s.playerRowIndex !== null)
      .map((s) => players.find((p) => p.rowIndex === s.playerRowIndex))
      .filter((p): p is ScoutPlayer => !!p);
  }, [selectedTeam, players]);

  const ratingCountFor = useCallback(
    (playerRowIndex: number) => ratings.filter((r) => r.playerRowIndex === playerRowIndex).length,
    [ratings]
  );

  // One editable rating per coach per player per game — find the current coach's
  // own rating (if any) so the modal can be reopened pre-filled instead of blank.
  const myRatingFor = useCallback(
    (playerRowIndex: number) =>
      ratings.find(
        (r) =>
          r.playerRowIndex === playerRowIndex &&
          r.teamIndex === selectedTeamIndex &&
          r.coachEmail.toLowerCase() === user.email.toLowerCase()
      ) || null,
    [ratings, selectedTeamIndex, user.email]
  );

  const handleSaveRating = async (payload: InGameRatingPayload) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/scout/in-game-ratings?sheetKey=${encodeURIComponent(sheetKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await fetchRatings();
        setActivePlayer(null);
        setToast('Rating saved');
      } else if (isRetryable(res.status)) {
        enqueueRating(sheetKey, payload);
        refreshPendingCount();
        setActivePlayer(null);
        setToast('Saved offline — will sync automatically');
      } else {
        const data = await res.json().catch(() => ({}));
        setToast(data.error || 'Failed to save rating');
      }
    } catch {
      // fetch threw — network unreachable; queue for retry rather than losing the rating.
      enqueueRating(sheetKey, payload);
      refreshPendingCount();
      setActivePlayer(null);
      setToast('Saved offline — will sync automatically');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(245,240,232,0.4)', fontFamily: FONT }}>
        Loading…
      </div>
    );
  }

  if (!approved) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(245,240,232,0.4)', fontFamily: FONT }}>
        No approved roster yet — ask an admin to finalize a Team Package before rating games.
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 style={{ color: '#f5f0e8', fontFamily: FONT, fontSize: 20, fontWeight: 700, margin: 0 }}>
          In-Game Ratings
        </h2>
        <span style={{ color: 'rgba(245,240,232,0.35)', fontFamily: FONT, fontSize: 12 }}>
          Roster: {approved.packageName}
        </span>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2">
            <span style={{
              background: 'rgba(245,166,35,0.15)', color: '#ffb74d', borderRadius: 5,
              padding: '3px 10px', fontFamily: FONT, fontSize: 11, fontWeight: 700,
            }}>
              ⏳ {pendingCount} pending sync
            </span>
            <button
              onClick={() => flushQueue()}
              style={{
                fontFamily: FONT, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 5,
                background: 'none', color: '#ffb74d', border: '1px solid rgba(255,183,77,0.4)', cursor: 'pointer',
              }}
            >
              Sync now
            </button>
          </div>
        )}
      </div>

      {/* Game tabs */}
      <div className="flex flex-wrap gap-2 mb-3">
        {GAME_NUMBERS.map((g) => (
          <button
            key={g}
            onClick={() => setSelectedGame(g)}
            style={{
              fontFamily: FONT, fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 6,
              background: selectedGame === g ? '#c0392b' : 'rgba(245,240,232,0.06)',
              color: selectedGame === g ? '#fff' : 'rgba(245,240,232,0.6)',
              border: `1px solid ${selectedGame === g ? '#c0392b' : 'rgba(245,240,232,0.15)'}`,
              cursor: 'pointer',
            }}
          >
            Game {g}
          </button>
        ))}
      </div>

      {/* Team chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {approved.teams.map((t) => {
          const tc = TEAM_COLORS[t.teamIndex - 1];
          const isActive = selectedTeamIndex === t.teamIndex;
          return (
            <button
              key={t.teamIndex}
              onClick={() => setSelectedTeamIndex(t.teamIndex)}
              style={{
                fontFamily: FONT, fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 6,
                background: isActive ? tc.bg : tc.dim,
                color: isActive ? '#fff' : tc.text,
                border: `1px solid ${tc.bg}`,
                cursor: 'pointer',
              }}
            >
              {t.teamName}
            </button>
          );
        })}
      </div>

      {ratingsLoading && (
        <div style={{ color: 'rgba(245,240,232,0.3)', fontFamily: FONT, fontSize: 11, marginBottom: 8 }}>
          Refreshing ratings…
        </div>
      )}

      <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(192,57,43,0.2)' }}>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#2a1818', borderBottom: '2px solid rgba(192,57,43,0.3)' }}>
              {['Player', 'Ratings This Game', ''].map((h) => (
                <th key={h} style={{
                  padding: '8px 14px', textAlign: 'left', fontFamily: FONT,
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: 'rgba(245,240,232,0.4)',
                  whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rosterPlayers.map((p, i) => (
              <tr key={p.rowIndex} style={{
                background: i % 2 === 0 ? '#1e1212' : '#1a1010',
                borderBottom: '1px solid rgba(192,57,43,0.06)',
              }}>
                <td style={{ padding: '9px 14px', fontFamily: FONT, fontSize: 12, fontWeight: 700, color: '#f5f0e8', whiteSpace: 'nowrap' }}>
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                      style={{ background: '#2e4030', color: '#fff' }}
                    >
                      {playerInitials(p.name)}
                    </span>
                    {p.name}
                  </span>
                </td>
                <td style={{ padding: '9px 14px', fontFamily: FONT, fontSize: 11, whiteSpace: 'nowrap',
                  color: ratingCountFor(p.rowIndex) > 0 ? '#81c784' : 'rgba(245,240,232,0.3)' }}>
                  {ratingCountFor(p.rowIndex)}
                </td>
                <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                  <button
                    onClick={() => setActivePlayer(p)}
                    style={{
                      fontFamily: FONT, fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 5,
                      background: '#c0392b', color: '#fff', border: 'none', cursor: 'pointer',
                    }}
                  >
                    {myRatingFor(p.rowIndex) ? 'Edit' : 'Rate'}
                  </button>
                </td>
              </tr>
            ))}
            {rosterPlayers.length === 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(245,240,232,0.25)', fontFamily: FONT }}>
                  No players assigned to this team yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {activePlayer && (
        <InGameRatingModal
          player={activePlayer}
          gameNumber={selectedGame}
          teamIndex={selectedTeamIndex}
          existingRating={myRatingFor(activePlayer.rowIndex)?.rating ?? null}
          onClose={() => setActivePlayer(null)}
          onSave={handleSaveRating}
          saving={saving}
        />
      )}

      {toast && (
        <div
          style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: '#1a2e1a', color: '#f5f0e8', padding: '10px 20px', borderRadius: 8,
            fontFamily: FONT, fontSize: 13, fontWeight: 700, zIndex: 60,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
