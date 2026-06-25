'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ScoutPlayer, TeamPackage, InGameRatingRecord, InGameRating } from '@/types/scout';
import type { AppUser } from '@/types';
import { playerInitials } from '@/lib/scout-schemas';
import { InGamePlayerCardModal } from './InGamePlayerCardModal';

const FONT = 'Barlow Condensed, sans-serif';

function sectionsRated(r: InGameRating): string[] {
  const out: string[] = [];
  if (Object.values(r.battingSkills).some((v) => v > 0) || r.battingCatchesDropped.length > 0 || r.battingNotes.trim()) out.push('BAT');
  if (r.bowledFast) out.push('FB');
  if (r.bowledSpin) out.push('SB');
  if (r.keptWicket) out.push('WK');
  if (r.fieldingEntries.length > 0 || r.fieldingNotes.trim()) out.push('FIELD');
  return out;
}

function FilterChips({
  label,
  options,
  counts,
  active,
  onToggle,
  onClear,
}: {
  label: string;
  options: string[];
  counts: Map<string, number>;
  active: string[];
  onToggle: (v: string) => void;
  onClear: () => void;
}) {
  if (options.length <= 1) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-2">
      <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.35)', fontFamily: FONT }}>{label}:</span>
      {options.map((opt) => {
        const isActive = active.includes(opt);
        return (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            style={{
              padding: '2px 9px', borderRadius: 4, fontSize: 11, fontWeight: 700, fontFamily: FONT,
              background: isActive ? 'rgba(192,57,43,0.25)' : 'rgba(255,255,255,0.05)',
              color: isActive ? '#ef9a9a' : 'rgba(245,240,232,0.4)',
              border: `1px solid ${isActive ? 'rgba(192,57,43,0.5)' : 'rgba(255,255,255,0.08)'}`,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
          >
            {opt}
            <span style={{ opacity: isActive ? 0.75 : 0.5, fontWeight: 600, fontSize: 10 }}>{counts.get(opt) ?? 0}</span>
          </button>
        );
      })}
      {active.length > 0 && (
        <button
          onClick={onClear}
          style={{ fontSize: 10, color: 'rgba(245,240,232,0.3)', fontFamily: FONT, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
        >
          ✕ clear
        </button>
      )}
    </div>
  );
}

export function InGameRatingsTable({
  players,
  user,
  sheetKey,
  scope,
}: {
  players: ScoutPlayer[];
  user: AppUser;
  sheetKey: string;
  scope: 'mine' | 'all';
}) {
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState<InGameRatingRecord[]>([]);
  const [approved, setApproved] = useState<TeamPackage | null>(null);
  const [search, setSearch] = useState('');
  const [coachFilters, setCoachFilters] = useState<string[]>([]);
  const [gameFilters, setGameFilters] = useState<number[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [cardPlayer, setCardPlayer] = useState<ScoutPlayer | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ratingsRes, rosterRes] = await Promise.all([
        fetch(`/api/scout/in-game-ratings?sheetKey=${encodeURIComponent(sheetKey)}`),
        fetch(`/api/scout/approved-roster?sheetKey=${encodeURIComponent(sheetKey)}`),
      ]);
      const ratingsData = await ratingsRes.json();
      const rosterData = await rosterRes.json();
      setRatings(ratingsData.ratings || []);
      setApproved(rosterData.approved || null);
    } catch {}
    setLoading(false);
  }, [sheetKey]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const teamNameFor = useCallback(
    (teamIndex: number) => approved?.teams.find((t) => t.teamIndex === teamIndex)?.teamName || `Team ${teamIndex}`,
    [approved]
  );

  const playerByRowIndex = useMemo(() => {
    const m = new Map<number, ScoutPlayer>();
    for (const p of players) m.set(p.rowIndex, p);
    return m;
  }, [players]);

  const scopedRatings = useMemo(
    () => (scope === 'mine' ? ratings.filter((r) => r.coachEmail.toLowerCase() === user.email.toLowerCase()) : ratings),
    [ratings, scope, user.email]
  );

  const rows = useMemo(
    () => scopedRatings
      .map((r) => ({ r, player: playerByRowIndex.get(r.playerRowIndex) }))
      .filter((row): row is { r: InGameRatingRecord; player: ScoutPlayer } => !!row.player),
    [scopedRatings, playerByRowIndex]
  );

  const allCoaches = useMemo(() => {
    const s = new Set<string>();
    for (const { r } of rows) s.add(r.coachName);
    return Array.from(s).sort();
  }, [rows]);
  const coachCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const { r } of rows) m.set(r.coachName, (m.get(r.coachName) ?? 0) + 1);
    return m;
  }, [rows]);

  const allGames = useMemo(() => {
    const s = new Set<number>();
    for (const { r } of rows) s.add(r.gameNumber);
    return Array.from(s).sort((a, b) => a - b);
  }, [rows]);
  const gameCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const { r } of rows) m.set(r.gameNumber, (m.get(r.gameNumber) ?? 0) + 1);
    return m;
  }, [rows]);

  const allCategories = useMemo(() => {
    const s = new Set<string>();
    for (const { player } of rows) if (player.category) s.add(player.category);
    return Array.from(s).sort();
  }, [rows]);
  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const { player } of rows) if (player.category) m.set(player.category, (m.get(player.category) ?? 0) + 1);
    return m;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(({ r, player }) => {
      if (coachFilters.length > 0 && !coachFilters.includes(r.coachName)) return false;
      if (gameFilters.length > 0 && !gameFilters.includes(r.gameNumber)) return false;
      if (categoryFilters.length > 0 && !categoryFilters.includes(player.category)) return false;
      if (q && !player.name.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => b.r.savedAt.localeCompare(a.r.savedAt));
  }, [rows, coachFilters, gameFilters, categoryFilters, search]);

  const toggleCoach = (v: string) => setCoachFilters((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  const toggleGame = (v: number) => setGameFilters((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  const toggleCategory = (v: string) => setCategoryFilters((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm('Delete this rating? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/scout/in-game-ratings?sheetKey=${encodeURIComponent(sheetKey)}&id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setRatings((prev) => prev.filter((r) => r.id !== id));
        setToast('Rating deleted');
      } else {
        const data = await res.json().catch(() => ({}));
        setToast(data.error || 'Failed to delete rating');
      }
    } catch {
      setToast('Failed to delete rating');
    }
    setDeletingId(null);
  }, [sheetKey]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(245,240,232,0.4)', fontFamily: FONT }}>
        Loading…
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className="text-sm font-bold" style={{ color: 'rgba(245,240,232,0.5)', fontFamily: FONT }}>
          {filteredRows.length} rating{filteredRows.length !== 1 ? 's' : ''}
        </span>
        <div className="flex-1 min-w-[160px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player…"
            className="w-full text-xs px-3 py-1.5 rounded-md border"
            style={{ background: 'rgba(0,0,0,0.25)', color: '#f5f0e8', borderColor: 'rgba(245,240,232,0.15)', fontFamily: 'Barlow, sans-serif' }}
          />
        </div>
      </div>

      {scope === 'all' && (
        <FilterChips label="Coach" options={allCoaches} counts={coachCounts} active={coachFilters} onToggle={toggleCoach} onClear={() => setCoachFilters([])} />
      )}
      <FilterChips
        label="Game"
        options={allGames.map(String)}
        counts={new Map(Array.from(gameCounts.entries()).map(([k, v]) => [String(k), v]))}
        active={gameFilters.map(String)}
        onToggle={(v) => toggleGame(Number(v))}
        onClear={() => setGameFilters([])}
      />
      <FilterChips label="Category" options={allCategories} counts={categoryCounts} active={categoryFilters} onToggle={toggleCategory} onClear={() => setCategoryFilters([])} />

      <div className="rounded-xl overflow-hidden border mt-3" style={{ borderColor: 'rgba(192,57,43,0.2)' }}>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#2a1818', borderBottom: '2px solid rgba(192,57,43,0.3)' }}>
              {[
                'Player', 'Category',
                ...(scope === 'all' ? ['Coach'] : []),
                'Game', 'Team', 'Sections', 'Saved', '',
              ].map((h, idx) => (
                <th key={`${h}-${idx}`} style={{
                  padding: '8px 14px', textAlign: 'left', fontFamily: FONT,
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: 'rgba(245,240,232,0.4)',
                  whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(({ r, player }, i) => (
              <tr
                key={r.id}
                onClick={() => setCardPlayer(player)}
                style={{
                  background: i % 2 === 0 ? '#1e1212' : '#1a1010',
                  borderBottom: '1px solid rgba(192,57,43,0.06)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(192,57,43,0.07)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? '#1e1212' : '#1a1010'; }}
              >
                <td style={{ padding: '9px 14px', fontFamily: FONT, fontSize: 12, fontWeight: 700, color: '#f5f0e8', whiteSpace: 'nowrap' }}>
                  <span className="inline-flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: '#2e4030', color: '#fff' }}>
                      {playerInitials(player.name)}
                    </span>
                    {player.name}
                  </span>
                </td>
                <td style={{ padding: '9px 14px', fontFamily: FONT, fontSize: 11, color: 'rgba(245,240,232,0.5)', whiteSpace: 'nowrap' }}>
                  {player.category}
                </td>
                {scope === 'all' && (
                  <td style={{ padding: '9px 14px', fontFamily: FONT, fontSize: 11, color: 'rgba(245,240,232,0.5)', whiteSpace: 'nowrap' }}>
                    {r.coachName}
                  </td>
                )}
                <td style={{ padding: '9px 14px', fontFamily: FONT, fontSize: 11, color: 'rgba(245,240,232,0.5)', whiteSpace: 'nowrap' }}>
                  Game {r.gameNumber}
                </td>
                <td style={{ padding: '9px 14px', fontFamily: FONT, fontSize: 11, color: 'rgba(245,240,232,0.5)', whiteSpace: 'nowrap' }}>
                  {teamNameFor(r.teamIndex)}
                </td>
                <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                  <div className="flex gap-1">
                    {sectionsRated(r.rating).map((s) => (
                      <span key={s} style={{
                        background: 'rgba(200,168,75,0.15)', color: '#c8a84b', borderRadius: 3,
                        padding: '1px 6px', fontFamily: FONT, fontSize: 9, fontWeight: 700,
                      }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </td>
                <td style={{ padding: '9px 14px', fontFamily: FONT, fontSize: 11, color: 'rgba(245,240,232,0.3)', whiteSpace: 'nowrap' }}>
                  {r.savedAt ? new Date(r.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                </td>
                <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                  {r.coachEmail.toLowerCase() === user.email.toLowerCase() && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                      disabled={deletingId === r.id}
                      style={{
                        fontFamily: FONT, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 5,
                        background: 'rgba(192,57,43,0.12)', color: '#ef9a9a', border: '1px solid rgba(192,57,43,0.3)',
                        cursor: deletingId === r.id ? 'default' : 'pointer', opacity: deletingId === r.id ? 0.5 : 1,
                      }}
                    >
                      {deletingId === r.id ? 'Deleting…' : 'Delete'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={scope === 'all' ? 8 : 7} style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(245,240,232,0.25)', fontFamily: FONT }}>
                  No ratings found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {cardPlayer && (
        <InGamePlayerCardModal
          player={cardPlayer}
          ratings={ratings.filter((r) => r.playerRowIndex === cardPlayer.rowIndex)}
          userEmail={user.email}
          teamNameFor={teamNameFor}
          onDelete={handleDelete}
          onClose={() => setCardPlayer(null)}
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
