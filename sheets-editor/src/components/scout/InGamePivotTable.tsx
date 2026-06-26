'use client';

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import Papa from 'papaparse';
import type { ScoutPlayer, TeamPackage, InGameRatingRecord } from '@/types/scout';
import type { AppUser } from '@/types';
import {
  BATTING_SKILL_SECTIONS, FAST_BOWLING_SKILL_SECTIONS, SPIN_BOWLING_SKILL_SECTIONS,
  type InGameSkillSection, type InGameSkillDef,
} from '@/lib/ingame-schemas';
import { InGamePlayerCardModal } from './InGamePlayerCardModal';

const FONT = 'Barlow Condensed, sans-serif';

type Discipline = 'battingSkills' | 'fastBowlingSkills' | 'spinBowlingSkills';

const DISCIPLINES: { key: Discipline; label: string; short: string; color: string; sections: InGameSkillSection[] }[] = [
  { key: 'battingSkills', label: 'BATTING', short: 'BAT', color: '#1565c0', sections: BATTING_SKILL_SECTIONS },
  { key: 'fastBowlingSkills', label: 'FAST BOWLING', short: 'FB', color: '#bf360c', sections: FAST_BOWLING_SKILL_SECTIONS },
  { key: 'spinBowlingSkills', label: 'SPIN BOWLING', short: 'SB', color: '#6a1b9a', sections: SPIN_BOWLING_SKILL_SECTIONS },
];

type ScoreEntry = { coachName: string; game: number; score: number };
type SkillStat = { avg: number; count: number; entries: ScoreEntry[] };

function getSkillStat(records: InGameRatingRecord[], group: Discipline, skillName: string): SkillStat | null {
  const entries = records
    .map((r) => ({ coachName: r.coachName || r.coachEmail, game: r.gameNumber, score: r.rating[group]?.[skillName] || 0 }))
    .filter((e) => e.score > 0);
  if (!entries.length) return null;
  const avg = entries.reduce((s, e) => s + e.score, 0) / entries.length;
  return { avg, count: entries.length, entries };
}

function getSectionAvg(records: InGameRatingRecord[], group: Discipline, skills: InGameSkillDef[]): number | null {
  const avgs: number[] = [];
  for (const sk of skills) {
    const stat = getSkillStat(records, group, sk.name);
    if (stat) avgs.push(stat.avg);
  }
  if (!avgs.length) return null;
  return avgs.reduce((a, b) => a + b, 0) / avgs.length;
}

function getDisciplineAvg(records: InGameRatingRecord[], group: Discipline, sections: InGameSkillSection[]): number | null {
  const avgs: number[] = [];
  for (const sec of sections) {
    for (const sk of sec.skills) {
      const stat = getSkillStat(records, group, sk.name);
      if (stat) avgs.push(stat.avg);
    }
  }
  if (!avgs.length) return null;
  return avgs.reduce((a, b) => a + b, 0) / avgs.length;
}

function skillScoreColor(avg: number): { bg: string; color: string } {
  if (avg >= 4) return { bg: 'rgba(27,94,32,0.45)', color: '#a5d6a7' };
  if (avg >= 3) return { bg: 'rgba(27,94,32,0.2)', color: '#81c784' };
  if (avg >= 2) return { bg: 'rgba(127,63,0,0.35)', color: '#ffcc80' };
  return { bg: 'rgba(127,31,31,0.35)', color: '#ef9a9a' };
}

type NoteItem = { coachName: string; game: number; label: string; note: string };

function getNoteItems(records: InGameRatingRecord[]): NoteItem[] {
  const items: NoteItem[] = [];
  for (const r of records) {
    const coachName = r.coachName || r.coachEmail;
    const push = (label: string, note: string) => {
      if (note && note.trim()) items.push({ coachName, game: r.gameNumber, label, note: note.trim() });
    };
    push('Batting', r.rating.battingNotes);
    push('Fast Bowling', r.rating.fastBowlingNotes);
    push('Spin Bowling', r.rating.spinBowlingNotes);
    push('WK', r.rating.wkNotes);
    push('Fielding', r.rating.fieldingNotes);
    push('Overall', r.rating.overallNotes);
  }
  return items;
}

const TH_BASE: React.CSSProperties = {
  padding: '5px 6px',
  fontSize: 10,
  fontFamily: FONT,
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

function stickyCellStyle(left: number, w: number, bg: string, zIndex = 2): React.CSSProperties {
  return { position: 'sticky', left, width: w, minWidth: w, maxWidth: w, zIndex, background: bg, boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.06)' };
}

function exportInGamePivotToCSV(players: ScoutPlayer[], recordsByPlayer: Map<number, InGameRatingRecord[]>) {
  type CsvRow = Record<string, string | number>;
  const rows: CsvRow[] = players.map((p) => {
    const records = recordsByPlayer.get(p.rowIndex) || [];
    const row: CsvRow = {
      Player: p.name,
      Category: p.category || '',
      Games: records.length,
      'WK Games': records.filter((r) => r.rating.keptWicket).length,
      'Fielding Games': records.filter((r) => r.rating.fieldingEntries.length > 0 || r.rating.fieldingNotes.trim()).length,
    };
    for (const d of DISCIPLINES) {
      const discAvgs: number[] = [];
      for (const sec of d.sections) {
        const secAvgs: number[] = [];
        for (const sk of sec.skills) {
          const stat = getSkillStat(records, d.key, sk.name);
          const colKey = `${d.short} ${sec.letter}:${sec.name} - ${sk.name}`;
          if (stat) {
            row[`${colKey} Avg`] = stat.avg.toFixed(5);
            row[`${colKey} N`] = stat.count;
            secAvgs.push(stat.avg);
            discAvgs.push(stat.avg);
          } else {
            row[`${colKey} Avg`] = '';
            row[`${colKey} N`] = '';
          }
        }
        row[`${d.short} ${sec.letter}:${sec.name} Sec Avg`] = secAvgs.length
          ? (secAvgs.reduce((a, b) => a + b, 0) / secAvgs.length).toFixed(5)
          : '';
      }
      row[`${d.short} Avg`] = discAvgs.length ? (discAvgs.reduce((a, b) => a + b, 0) / discAvgs.length).toFixed(5) : '';
    }
    row['Notes'] = getNoteItems(records).map((it) => `${it.coachName} (G${it.game} ${it.label}): ${it.note}`).join(' | ');
    return row;
  });
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `in-game-pivot-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type NotesPopover = { playerName: string; items: NoteItem[]; x: number; y: number };
type ScorePopover = { playerName: string; skillName: string; entries: ScoreEntry[]; x: number; y: number };

export function InGamePivotTable({
  players,
  user,
  sheetKey,
}: {
  players: ScoutPlayer[];
  user: AppUser;
  sheetKey: string;
}) {
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState<InGameRatingRecord[]>([]);
  const [approved, setApproved] = useState<TeamPackage | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [cardPlayer, setCardPlayer] = useState<ScoutPlayer | null>(null);
  const [notesPopover, setNotesPopover] = useState<NotesPopover | null>(null);
  const [scorePopover, setScorePopover] = useState<ScorePopover | null>(null);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

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

  const recordsByPlayer = useMemo(() => {
    const m = new Map<number, InGameRatingRecord[]>();
    for (const r of ratings) {
      const arr = m.get(r.playerRowIndex);
      if (arr) arr.push(r); else m.set(r.playerRowIndex, [r]);
    }
    return m;
  }, [ratings]);

  const ratedPlayers = useMemo(
    () => players.filter((p) => (recordsByPlayer.get(p.rowIndex)?.length ?? 0) > 0),
    [players, recordsByPlayer]
  );

  const allCategories = useMemo(() => {
    const s = new Set<string>();
    for (const p of ratedPlayers) if (p.category) s.add(p.category);
    return Array.from(s).sort();
  }, [ratedPlayers]);

  const filteredPlayers = useMemo(() => {
    const q = search.toLowerCase();
    return ratedPlayers.filter((p) => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [ratedPlayers, search, categoryFilter]);

  function toggleSort(col: string, defaultDir: 'asc' | 'desc' = 'desc') {
    if (sortCol === col) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortCol(col); setSortDir(defaultDir); }
  }

  function sortIndicator(col: string) {
    if (sortCol !== col) return null;
    return <span style={{ marginLeft: 2, fontSize: 9, opacity: 0.8 }}>{sortDir === 'desc' ? '↓' : '↑'}</span>;
  }

  const sortedPlayers = useMemo(() => {
    if (!sortCol) return filteredPlayers;
    return [...filteredPlayers].sort((a, b) => {
      const recA = recordsByPlayer.get(a.rowIndex) || [];
      const recB = recordsByPlayer.get(b.rowIndex) || [];
      if (sortCol === 'player') {
        const r = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        return sortDir === 'asc' ? r : -r;
      }
      if (sortCol === 'category') {
        const r = (a.category || '').toLowerCase().localeCompare((b.category || '').toLowerCase());
        return sortDir === 'asc' ? r : -r;
      }
      if (sortCol === 'games') {
        return sortDir === 'asc' ? recA.length - recB.length : recB.length - recA.length;
      }
      const disc = DISCIPLINES.find((d) => sortCol === `disc:${d.key}`);
      if (disc) {
        const va = getDisciplineAvg(recA, disc.key, disc.sections);
        const vb = getDisciplineAvg(recB, disc.key, disc.sections);
        if (va === null && vb === null) return 0;
        if (va === null) return 1;
        if (vb === null) return -1;
        return sortDir === 'desc' ? vb - va : va - vb;
      }
      if (sortCol.startsWith('sec:')) {
        const [discKey, letter] = sortCol.slice(4).split('|');
        const d = DISCIPLINES.find((x) => x.key === discKey);
        const sec = d?.sections.find((s) => s.letter === letter);
        if (d && sec) {
          const va = getSectionAvg(recA, d.key, sec.skills);
          const vb = getSectionAvg(recB, d.key, sec.skills);
          if (va === null && vb === null) return 0;
          if (va === null) return 1;
          if (vb === null) return -1;
          return sortDir === 'desc' ? vb - va : va - vb;
        }
      }
      return 0;
    });
  }, [filteredPlayers, sortCol, sortDir, recordsByPlayer]);

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm('Delete this rating? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/scout/in-game-ratings?sheetKey=${encodeURIComponent(sheetKey)}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) setRatings((prev) => prev.filter((r) => r.id !== id));
    } catch {}
  }, [sheetKey]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(245,240,232,0.4)', fontFamily: FONT }}>Loading…</div>;
  }

  const PLAYER_W = 150, CAT_W = 110, GAMES_W = 50, WK_W = 44, FIELD_W = 50;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className="text-sm font-bold" style={{ color: 'rgba(245,240,232,0.5)', fontFamily: FONT }}>
          {sortedPlayers.length} player{sortedPlayers.length !== 1 ? 's' : ''} rated
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search player…"
          className="text-xs px-3 py-1.5 rounded-md border"
          style={{ background: 'rgba(0,0,0,0.25)', color: '#f5f0e8', borderColor: 'rgba(245,240,232,0.15)', fontFamily: 'Barlow, sans-serif', minWidth: 160 }}
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-md border"
          style={{ background: 'rgba(0,0,0,0.25)', color: '#f5f0e8', borderColor: 'rgba(245,240,232,0.15)', fontFamily: FONT }}
        >
          <option value="all">All Categories</option>
          {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={() => exportInGamePivotToCSV(sortedPlayers, recordsByPlayer)}
          style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: FONT, background: 'rgba(200,168,75,0.15)', color: '#c8a84b', border: '1px solid rgba(200,168,75,0.3)', cursor: 'pointer' }}
        >
          ⬇ Export CSV
        </button>
      </div>

      {sortedPlayers.length === 0 ? (
        <div className="py-8 text-center" style={{ color: 'rgba(245,240,232,0.4)', fontFamily: FONT }}>No in-game ratings found</div>
      ) : (
        <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 4 }}>
              <tr>
                <th rowSpan={4} onClick={() => toggleSort('player', 'asc')} style={{ ...TH_BASE, ...stickyCellStyle(0, PLAYER_W, '#1a1010', 3), top: 0, textAlign: 'left', color: sortCol === 'player' ? '#c8a84b' : 'rgba(245,240,232,0.6)', cursor: 'pointer', userSelect: 'none' }}>Player{sortIndicator('player')}</th>
                <th rowSpan={4} onClick={() => toggleSort('category', 'asc')} style={{ ...TH_BASE, ...stickyCellStyle(PLAYER_W, CAT_W, '#1a1010', 3), top: 0, textAlign: 'left', color: sortCol === 'category' ? '#c8a84b' : 'rgba(245,240,232,0.6)', cursor: 'pointer', userSelect: 'none' }}>Category{sortIndicator('category')}</th>
                <th rowSpan={4} onClick={() => toggleSort('games')} style={{ ...TH_BASE, ...stickyCellStyle(PLAYER_W + CAT_W, GAMES_W, '#1a1010', 3), top: 0, textAlign: 'center', color: sortCol === 'games' ? '#c8a84b' : 'rgba(245,240,232,0.6)', cursor: 'pointer', userSelect: 'none' }}>Games{sortIndicator('games')}</th>
                <th rowSpan={4} style={{ ...TH_BASE, ...stickyCellStyle(PLAYER_W + CAT_W + GAMES_W, WK_W, '#1a1010', 3), top: 0, textAlign: 'center' }}>WK</th>
                <th rowSpan={4} style={{ ...TH_BASE, ...stickyCellStyle(PLAYER_W + CAT_W + GAMES_W + WK_W, FIELD_W, '#1a1010', 3), top: 0, textAlign: 'center' }}>Field</th>
                {DISCIPLINES.map((d) => {
                  const colSpan = d.sections.reduce((s, sec) => s + sec.skills.length * 2 + 1, 0) + 1;
                  return (
                    <th key={d.key} colSpan={colSpan} style={{ ...TH_BASE, textAlign: 'center', color: d.color, borderBottom: `2px solid ${d.color}55`, fontSize: 12, letterSpacing: '0.1em' }}>
                      {d.label}
                    </th>
                  );
                })}
                <th rowSpan={4} style={{ ...TH_BASE, position: 'sticky', top: 0, zIndex: 2, textAlign: 'left', minWidth: 220, color: 'rgba(245,240,232,0.6)', paddingLeft: 10, background: '#1a1010' }}>Notes</th>
              </tr>
              <tr>
                {DISCIPLINES.map((d) => (
                  <Fragment key={`hdr2-${d.key}`}>
                    {d.sections.map((sec) => (
                      <th key={`${d.key}-${sec.letter}`} colSpan={sec.skills.length * 2 + 1} style={{ ...TH_BASE, textAlign: 'center', fontSize: 10, color: 'rgba(245,240,232,0.45)', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                        {sec.letter}: {sec.name}
                      </th>
                    ))}
                    <th rowSpan={3} onClick={() => toggleSort(`disc:${d.key}`)} style={{ ...TH_BASE, textAlign: 'center', width: 46, minWidth: 46, fontSize: 9, fontWeight: 800, color: d.color, borderLeft: `2px solid ${d.color}44`, background: `${d.color}0d`, letterSpacing: '0.04em', verticalAlign: 'middle', cursor: 'pointer', userSelect: 'none' }}>
                      Avg{sortCol === `disc:${d.key}` ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                    </th>
                  </Fragment>
                ))}
              </tr>
              <tr>
                {DISCIPLINES.map((d) =>
                  d.sections.map((sec) => (
                    <Fragment key={`hdr3-${d.key}-${sec.letter}`}>
                      {sec.skills.map((sk) => (
                        <th key={`${d.key}-${sec.letter}-${sk.name}`} colSpan={2} style={{ ...TH_BASE, textAlign: 'center', fontSize: 9, color: 'rgba(245,240,232,0.45)', borderLeft: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'normal', wordBreak: 'break-word', minWidth: 62, maxWidth: 80, padding: '4px 3px' }}>
                          {sk.name}
                        </th>
                      ))}
                      <th rowSpan={2} onClick={() => toggleSort(`sec:${d.key}|${sec.letter}`)} style={{ ...TH_BASE, textAlign: 'center', width: 40, minWidth: 40, fontSize: 9, fontWeight: 800, color: sortCol === `sec:${d.key}|${sec.letter}` ? '#c8a84b' : 'rgba(245,240,232,0.5)', borderLeft: '1px solid rgba(255,255,255,0.12)', background: sortCol === `sec:${d.key}|${sec.letter}` ? 'rgba(200,168,75,0.1)' : 'rgba(255,255,255,0.04)', letterSpacing: '0.04em', verticalAlign: 'middle', cursor: 'pointer', userSelect: 'none' }}>
                        Sec<br />Avg
                      </th>
                    </Fragment>
                  ))
                )}
              </tr>
              <tr>
                {DISCIPLINES.map((d) =>
                  d.sections.flatMap((sec) =>
                    sec.skills.map((sk) => (
                      <Fragment key={`${d.key}-${sec.letter}-${sk.name}-sub`}>
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
                const records = recordsByPlayer.get(player.rowIndex) || [];
                const wkGames = records.filter((r) => r.rating.keptWicket).length;
                const fieldGames = records.filter((r) => r.rating.fieldingEntries.length > 0 || r.rating.fieldingNotes.trim()).length;
                const noteItems = getNoteItems(records);
                const notesJoined = noteItems.map((it) => `${it.coachName} (G${it.game} ${it.label}): ${it.note}`).join(' · ');
                const rowBg = pi % 2 === 0 ? '#1a1010' : '#1e1212';
                return (
                  <tr key={player.rowIndex} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ ...stickyCellStyle(0, PLAYER_W, rowBg), padding: '5px 8px' }}>
                      <button onClick={() => setCardPlayer(player)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: FONT, fontWeight: 700, fontSize: 12, color: '#f5f0e8', padding: 0, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#c8a84b'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#f5f0e8'; }}>
                        {player.name}
                      </button>
                    </td>
                    <td style={{ ...stickyCellStyle(PLAYER_W, CAT_W, rowBg), padding: '5px 6px', fontFamily: FONT, fontSize: 10, color: 'rgba(245,240,232,0.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {player.category || '—'}
                    </td>
                    <td style={{ ...stickyCellStyle(PLAYER_W + CAT_W, GAMES_W, rowBg), textAlign: 'center', padding: '5px 4px', fontFamily: FONT, fontSize: 11, fontWeight: 700, color: 'rgba(245,240,232,0.7)' }}>
                      {records.length}
                    </td>
                    <td style={{ ...stickyCellStyle(PLAYER_W + CAT_W + GAMES_W, WK_W, rowBg), textAlign: 'center', padding: '5px 4px', fontFamily: FONT, fontSize: 11, color: 'rgba(245,240,232,0.6)' }}>
                      {wkGames > 0 ? wkGames : <span style={{ color: 'rgba(245,240,232,0.2)' }}>—</span>}
                    </td>
                    <td style={{ ...stickyCellStyle(PLAYER_W + CAT_W + GAMES_W + WK_W, FIELD_W, rowBg), textAlign: 'center', padding: '5px 4px', fontFamily: FONT, fontSize: 11, color: 'rgba(245,240,232,0.6)' }}>
                      {fieldGames > 0 ? fieldGames : <span style={{ color: 'rgba(245,240,232,0.2)' }}>—</span>}
                    </td>
                    {DISCIPLINES.map((d) => {
                      const discAvg = getDisciplineAvg(records, d.key, d.sections);
                      const discSc = discAvg !== null ? skillScoreColor(discAvg) : null;
                      return (
                        <Fragment key={`${player.rowIndex}-${d.key}`}>
                          {d.sections.map((sec) => {
                            const secAvg = getSectionAvg(records, d.key, sec.skills);
                            const secSc = secAvg !== null ? skillScoreColor(secAvg) : null;
                            return (
                              <Fragment key={`${player.rowIndex}-${d.key}-${sec.letter}`}>
                                {sec.skills.map((sk) => {
                                  const stat = getSkillStat(records, d.key, sk.name);
                                  if (!stat) {
                                    return (
                                      <Fragment key={`${player.rowIndex}-${d.key}-${sec.letter}-${sk.name}`}>
                                        <td style={{ textAlign: 'center', padding: '4px 2px', fontSize: 10, color: 'rgba(245,240,232,0.15)', background: rowBg, borderLeft: '1px solid rgba(255,255,255,0.03)' }}>—</td>
                                        <td style={{ background: rowBg }} />
                                      </Fragment>
                                    );
                                  }
                                  const sc = skillScoreColor(stat.avg);
                                  return (
                                    <Fragment key={`${player.rowIndex}-${d.key}-${sec.letter}-${sk.name}`}>
                                      <td
                                        title={`${stat.avg.toFixed(3)} (${stat.count} rating${stat.count !== 1 ? 's' : ''})`}
                                        style={{ textAlign: 'center', padding: '4px 3px', fontSize: 11, fontWeight: 700, fontFamily: FONT, background: sc.bg, color: sc.color, cursor: 'pointer', borderLeft: '1px solid rgba(255,255,255,0.04)' }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                          setNotesPopover(null);
                                          setScorePopover({ playerName: player.name, skillName: sk.name, entries: stat.entries, x: rect.left, y: rect.bottom + 6 });
                                        }}>
                                        {stat.avg.toFixed(3)}
                                      </td>
                                      <td style={{ textAlign: 'center', padding: '4px 2px', fontSize: 9, color: 'rgba(245,240,232,0.3)', background: rowBg }}>
                                        {stat.count}
                                      </td>
                                    </Fragment>
                                  );
                                })}
                                <td style={{ textAlign: 'center', padding: '4px 4px', fontSize: 11, fontWeight: 800, fontFamily: FONT, background: secSc ? secSc.bg : rowBg, color: secSc ? secSc.color : 'rgba(245,240,232,0.2)', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                                  {secAvg !== null ? secAvg.toFixed(3) : '—'}
                                </td>
                              </Fragment>
                            );
                          })}
                          <td style={{ textAlign: 'center', padding: '4px 5px', fontSize: 12, fontWeight: 800, fontFamily: FONT, background: discSc ? discSc.bg : rowBg, color: discSc ? discSc.color : 'rgba(245,240,232,0.2)', borderLeft: `2px solid ${d.color}33` }}>
                            {discAvg !== null ? discAvg.toFixed(3) : '—'}
                          </td>
                        </Fragment>
                      );
                    })}
                    <td
                      style={{ padding: '5px 10px', fontSize: 11, color: noteItems.length ? 'rgba(245,240,232,0.6)' : 'rgba(245,240,232,0.2)', background: rowBg, maxWidth: 220, cursor: noteItems.length ? 'pointer' : 'default' }}
                      onClick={(e) => {
                        if (!noteItems.length) return;
                        e.stopPropagation();
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setScorePopover(null);
                        setNotesPopover({ playerName: player.name, items: noteItems, x: rect.left, y: rect.bottom + 6 });
                      }}
                      onMouseEnter={(e) => { if (noteItems.length) (e.currentTarget as HTMLElement).style.color = '#c8a84b'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = noteItems.length ? 'rgba(245,240,232,0.6)' : 'rgba(245,240,232,0.2)'; }}>
                      {noteItems.length ? (
                        <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
                          {notesJoined}
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

      {scorePopover && (
        <div onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', left: Math.min(scorePopover.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 230), top: Math.min(scorePopover.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 220), zIndex: 1000, background: '#1a1010', border: '1px solid rgba(192,57,43,0.4)', borderRadius: 8, padding: '12px 14px', minWidth: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.7)' }}>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: '#c8a84b', marginBottom: 2 }}>{scorePopover.playerName}</div>
          <div style={{ fontFamily: FONT, fontSize: 11, color: 'rgba(245,240,232,0.45)', marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8 }}>{scorePopover.skillName}</div>
          {scorePopover.entries.map((entry, i) => {
            const sc = skillScoreColor(entry.score);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 5 }}>
                <span style={{ fontFamily: FONT, fontSize: 12, color: 'rgba(245,240,232,0.75)', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.coachName} · G{entry.game}
                </span>
                <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: sc.color, whiteSpace: 'nowrap' }}>
                  {'★'.repeat(entry.score)}{'☆'.repeat(Math.max(0, 5 - entry.score))} {entry.score}/5
                </span>
              </div>
            );
          })}
        </div>
      )}

      {notesPopover && (
        <div onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', left: Math.min(notesPopover.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 320), top: Math.min(notesPopover.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 260), zIndex: 1000, background: '#1a1010', border: '1px solid rgba(200,168,75,0.35)', borderRadius: 8, padding: '12px 14px', minWidth: 280, maxWidth: 340, maxHeight: 320, overflow: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.7)' }}>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: '#c8a84b', marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8 }}>
            {notesPopover.playerName} — Notes
          </div>
          {notesPopover.items.map((item, i) => (
            <div key={i} style={{ marginBottom: i < notesPopover.items.length - 1 ? 10 : 0 }}>
              <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: 'rgba(245,240,232,0.5)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {item.coachName} · Game {item.game} · {item.label}
              </div>
              <div style={{ fontFamily: FONT, fontSize: 12, color: 'rgba(245,240,232,0.85)', lineHeight: 1.5 }}>
                {item.note}
              </div>
            </div>
          ))}
        </div>
      )}

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
    </div>
  );
}
