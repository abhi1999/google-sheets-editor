'use client';

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import type { ScoutPlayer, TeamPackage, PackageTeam, OpportunityRecord, OpportunityEntry } from '@/types/scout';
import { GAME_NUMBERS } from '@/lib/ingame-schemas';
import { emptyOpportunityEntry } from '@/lib/opportunity-schemas';
import { playerInitials } from '@/lib/scout-schemas';
import { TEAM_COLORS, slotRole } from './TeamSelectionBoard';

const FONT = 'Barlow Condensed, sans-serif';

type Mode = 'edit' | 'view';

function roleFor(team: PackageTeam, playerRowIndex: number): string | null {
  const slotData = team.slots.find((s) => s.playerRowIndex === playerRowIndex);
  if (!slotData) return null;
  // A custom role on the slot (set for reserves in Team Packages) overrides the generic
  // slot-template label — e.g. "Backup Opener" instead of just "Reserve".
  if (slotData.role) return slotData.role;
  return slotRole(slotData.slot);
}

const ROLE_BADGES = [
  { code: 'C', match: (t: PackageTeam, pid: number) => t.captain === pid, bg: 'rgba(200,168,75,0.35)', color: '#c8a84b', border: 'rgba(200,168,75,0.6)' },
  { code: 'VC', match: (t: PackageTeam, pid: number) => t.vc === pid, bg: 'rgba(144,202,249,0.2)', color: '#90caf9', border: 'rgba(144,202,249,0.45)' },
  { code: 'WK', match: (t: PackageTeam, pid: number) => (t.wks ?? []).includes(pid), bg: 'rgba(128,203,196,0.2)', color: '#80cbc4', border: 'rgba(128,203,196,0.45)' },
] as const;

// Name + avatar + Captain/Vice-Captain/Wicketkeeper badges + the player's slot role from the
// team package — shared between Edit and View mode so the two stay in sync.
function PlayerNameCell({ player, team }: { player: ScoutPlayer; team: PackageTeam }) {
  const role = roleFor(team, player.rowIndex);
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
        style={{ background: '#2e4030', color: '#fff' }}
      >
        {playerInitials(player.name)}
      </span>
      {player.name}
      {ROLE_BADGES.filter((b) => b.match(team, player.rowIndex)).map((b) => (
        <span key={b.code} style={{
          flexShrink: 0, fontFamily: FONT, fontWeight: 800, fontSize: 9,
          padding: '1px 4px', borderRadius: 3, lineHeight: 1.4,
          background: b.bg, color: b.color, border: `1px solid ${b.border}`,
        }}>
          {b.code}
        </span>
      ))}
      {role && (
        <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 600, color: 'rgba(245,240,232,0.35)', whiteSpace: 'nowrap' }}>
          {role}
        </span>
      )}
    </span>
  );
}

export function OpportunitySheetBoard({
  players,
  sheetKey,
}: {
  players: ScoutPlayer[];
  sheetKey: string;
}) {
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState<TeamPackage | null>(null);
  const [records, setRecords] = useState<OpportunityRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('view');
  const [selectedTeamIndex, setSelectedTeamIndex] = useState<number>(1);
  const [selectedGame, setSelectedGame] = useState<number>(1);
  const [draft, setDraft] = useState<Record<number, OpportunityEntry>>({});
  const [coachNameDraft, setCoachNameDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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

  const fetchRecords = useCallback(async () => {
    setRecordsLoading(true);
    try {
      const res = await fetch(`/api/scout/opportunity-sheet?sheetKey=${encodeURIComponent(sheetKey)}`);
      const data = await res.json();
      setRecords(data.records || []);
    } catch {}
    setRecordsLoading(false);
  }, [sheetKey]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const teamFor = useCallback(
    (teamIndex: number) => approved?.teams.find((t) => t.teamIndex === teamIndex) || null,
    [approved]
  );

  const rosterFor = useCallback(
    (teamIndex: number) => {
      const team = teamFor(teamIndex);
      if (!team) return [];
      return team.slots
        .filter((s) => s.playerRowIndex !== null)
        .map((s) => players.find((p) => p.rowIndex === s.playerRowIndex))
        .filter((p): p is ScoutPlayer => !!p);
    },
    [teamFor, players]
  );

  const selectedTeam = useMemo(() => teamFor(selectedTeamIndex), [teamFor, selectedTeamIndex]);
  const rosterPlayers = useMemo(() => rosterFor(selectedTeamIndex), [rosterFor, selectedTeamIndex]);

  const recordFor = useCallback(
    (teamIndex: number, gameNumber: number) => records.find((r) => r.teamIndex === teamIndex && r.gameNumber === gameNumber) || null,
    [records]
  );

  // Rebuild the editable draft whenever the selected team/game changes (or fresh data loads).
  useEffect(() => {
    const existing = recordFor(selectedTeamIndex, selectedGame);
    const map: Record<number, OpportunityEntry> = {};
    for (const p of rosterPlayers) {
      const found = existing?.entries.find((e) => e.playerRowIndex === p.rowIndex);
      map[p.rowIndex] = found || emptyOpportunityEntry(p.rowIndex);
    }
    setDraft(map);
    setCoachNameDraft(existing?.coachName || '');
  }, [selectedTeamIndex, selectedGame, rosterPlayers, recordFor]);

  const updateDraft = (playerRowIndex: number, patch: Partial<OpportunityEntry>) => {
    setDraft((prev) => ({ ...prev, [playerRowIndex]: { ...prev[playerRowIndex], ...patch } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries = rosterPlayers.map((p) => draft[p.rowIndex] || emptyOpportunityEntry(p.rowIndex));
      const res = await fetch(`/api/scout/opportunity-sheet?sheetKey=${encodeURIComponent(sheetKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamIndex: selectedTeamIndex, gameNumber: selectedGame, coachName: coachNameDraft, entries }),
      });
      if (res.ok) {
        await fetchRecords();
        setToast('Opportunity sheet saved');
      } else {
        const data = await res.json().catch(() => ({}));
        setToast(data.error || 'Failed to save');
      }
    } catch {
      setToast('Failed to save');
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
        No approved roster yet — ask an admin to finalize a Team Package before tracking opportunities.
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 style={{ color: '#f5f0e8', fontFamily: FONT, fontSize: 20, fontWeight: 700, margin: 0 }}>
          Opportunity Sheet
        </h2>
        <span style={{ color: 'rgba(245,240,232,0.35)', fontFamily: FONT, fontSize: 12 }}>
          Roster: {approved.packageName}
        </span>
        <div className="flex gap-1 ml-auto">
          {(['view', 'edit'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                fontFamily: FONT, fontSize: 12, fontWeight: 700, padding: '6px 16px', borderRadius: 6,
                background: mode === m ? '#c0392b' : 'rgba(245,240,232,0.06)',
                color: mode === m ? '#fff' : 'rgba(245,240,232,0.6)',
                border: `1px solid ${mode === m ? '#c0392b' : 'rgba(245,240,232,0.15)'}`,
                cursor: 'pointer', textTransform: 'capitalize',
              }}
            >
              {m}
            </button>
          ))}
        </div>
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

      {recordsLoading && (
        <div style={{ color: 'rgba(245,240,232,0.3)', fontFamily: FONT, fontSize: 11, marginBottom: 8 }}>
          Refreshing…
        </div>
      )}

      {mode === 'edit' ? (
        <>
          {/* Game tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
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

          <div className="flex items-center gap-3 mb-4">
            <label style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(245,240,232,0.45)' }}>
              Coach
            </label>
            <input
              type="text"
              value={coachNameDraft}
              onChange={(e) => setCoachNameDraft(e.target.value)}
              placeholder="Coach name for this game"
              style={{
                width: 240, fontFamily: FONT, fontSize: 12, padding: '6px 10px', borderRadius: 5,
                background: 'rgba(245,240,232,0.06)', border: '1px solid rgba(245,240,232,0.15)', color: '#f5f0e8',
              }}
            />
          </div>

          <div className="rounded-xl overflow-hidden border mb-4" style={{ borderColor: 'rgba(192,57,43,0.2)' }}>
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#2a1818', borderBottom: '2px solid rgba(192,57,43,0.3)' }}>
                  {['Player', 'Batting Order', 'Bowling Order', 'Overs Bowled'].map((h) => (
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
                {rosterPlayers.map((p, i) => {
                  const entry = draft[p.rowIndex] || emptyOpportunityEntry(p.rowIndex);
                  return (
                    <tr key={p.rowIndex} style={{
                      background: i % 2 === 0 ? '#1e1212' : '#1a1010',
                      borderBottom: '1px solid rgba(192,57,43,0.06)',
                    }}>
                      <td style={{ padding: '9px 14px', fontFamily: FONT, fontSize: 12, fontWeight: 700, color: '#f5f0e8', whiteSpace: 'nowrap' }}>
                        <PlayerNameCell player={p} team={selectedTeam!} />
                      </td>
                      <td style={{ padding: '6px 14px' }}>
                        <input
                          type="number"
                          min={1}
                          value={entry.battingOrder ?? ''}
                          onChange={(e) => updateDraft(p.rowIndex, { battingOrder: e.target.value === '' ? null : Number(e.target.value) })}
                          placeholder="—"
                          style={{
                            width: 70, fontFamily: FONT, fontSize: 12, padding: '5px 8px', borderRadius: 5,
                            background: 'rgba(245,240,232,0.06)', border: '1px solid rgba(245,240,232,0.15)', color: '#f5f0e8',
                          }}
                        />
                      </td>
                      <td style={{ padding: '6px 14px' }}>
                        <input
                          type="number"
                          min={1}
                          value={entry.bowlingOrder ?? ''}
                          onChange={(e) => updateDraft(p.rowIndex, { bowlingOrder: e.target.value === '' ? null : Number(e.target.value) })}
                          placeholder="—"
                          style={{
                            width: 70, fontFamily: FONT, fontSize: 12, padding: '5px 8px', borderRadius: 5,
                            background: 'rgba(245,240,232,0.06)', border: '1px solid rgba(245,240,232,0.15)', color: '#f5f0e8',
                          }}
                        />
                      </td>
                      <td style={{ padding: '6px 14px' }}>
                        <input
                          type="number"
                          min={0}
                          value={entry.oversBowled || ''}
                          onChange={(e) => updateDraft(p.rowIndex, { oversBowled: e.target.value === '' ? 0 : Number(e.target.value) })}
                          placeholder="0"
                          style={{
                            width: 70, fontFamily: FONT, fontSize: 12, padding: '5px 8px', borderRadius: 5,
                            background: 'rgba(245,240,232,0.06)', border: '1px solid rgba(245,240,232,0.15)', color: '#f5f0e8',
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
                {rosterPlayers.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(245,240,232,0.25)', fontFamily: FONT }}>
                      No players assigned to this team yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {rosterPlayers.length > 0 && (
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                fontFamily: FONT, fontSize: 13, fontWeight: 700, padding: '8px 24px', borderRadius: 6,
                background: '#c0392b', color: '#fff', border: 'none', cursor: saving ? 'default' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving…' : `Save Game ${selectedGame}`}
            </button>
          )}
        </>
      ) : (
        <div className="rounded-xl overflow-x-auto border" style={{ borderColor: 'rgba(192,57,43,0.2)' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ background: '#2a1818' }}>
                <th rowSpan={2} style={{
                  padding: '8px 14px', textAlign: 'left', fontFamily: FONT, fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.4)',
                  whiteSpace: 'nowrap', borderBottom: '2px solid rgba(192,57,43,0.3)', borderRight: '1px solid rgba(245,240,232,0.1)',
                  position: 'sticky', left: 0, background: '#2a1818',
                }}>Player</th>
                {GAME_NUMBERS.map((g) => {
                  const coachName = recordFor(selectedTeamIndex, g)?.coachName;
                  return (
                    <th key={g} colSpan={3} style={{
                      padding: '6px 14px', textAlign: 'center', fontFamily: FONT, fontSize: 10, fontWeight: 700,
                      letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.55)',
                      borderBottom: '1px solid rgba(245,240,232,0.1)', borderLeft: '1px solid rgba(245,240,232,0.08)',
                    }}>
                      <div>Game {g}</div>
                      <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'none', letterSpacing: 0, color: '#c8a84b', marginTop: 2 }}>
                        {coachName || '—'}
                      </div>
                    </th>
                  );
                })}
              </tr>
              <tr style={{ background: '#241515', borderBottom: '2px solid rgba(192,57,43,0.3)' }}>
                {GAME_NUMBERS.map((g) => (
                  <Fragment key={g}>
                    <th style={{ padding: '6px 10px', fontFamily: FONT, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(245,240,232,0.35)', borderLeft: '1px solid rgba(245,240,232,0.08)' }}>Bat</th>
                    <th style={{ padding: '6px 10px', fontFamily: FONT, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(245,240,232,0.35)' }}>Bowl</th>
                    <th style={{ padding: '6px 10px', fontFamily: FONT, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(245,240,232,0.35)' }}>Ov</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {rosterPlayers.map((p, i) => (
                <tr key={p.rowIndex} style={{
                  background: i % 2 === 0 ? '#1e1212' : '#1a1010',
                  borderBottom: '1px solid rgba(192,57,43,0.06)',
                }}>
                  <td style={{
                    padding: '8px 14px', fontFamily: FONT, fontSize: 12, fontWeight: 700, color: '#f5f0e8',
                    whiteSpace: 'nowrap', borderRight: '1px solid rgba(245,240,232,0.1)',
                    position: 'sticky', left: 0, background: i % 2 === 0 ? '#1e1212' : '#1a1010',
                  }}>
                    <PlayerNameCell player={p} team={selectedTeam!} />
                  </td>
                  {GAME_NUMBERS.map((g) => {
                    const entry = recordFor(selectedTeamIndex, g)?.entries.find((e) => e.playerRowIndex === p.rowIndex);
                    return (
                      <Fragment key={g}>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontFamily: FONT, fontSize: 12, color: 'rgba(245,240,232,0.8)', borderLeft: '1px solid rgba(245,240,232,0.06)' }}>
                          {entry?.battingOrder ?? '—'}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontFamily: FONT, fontSize: 12, color: 'rgba(245,240,232,0.8)' }}>
                          {entry?.bowlingOrder ?? '—'}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontFamily: FONT, fontSize: 12, color: 'rgba(245,240,232,0.8)' }}>
                          {entry?.oversBowled || '—'}
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
              ))}
              {rosterPlayers.length === 0 && (
                <tr>
                  <td colSpan={1 + GAME_NUMBERS.length * 3} style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(245,240,232,0.25)', fontFamily: FONT }}>
                    No players assigned to this team yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
