'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ScoutPlayer, TeamPackage, PackageTeam } from '@/types/scout';
import type { AppUser } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const TEAM_COLORS = [
  { name: 'Red',    bg: '#c0392b', text: '#ef9a9a', dim: 'rgba(192,57,43,0.18)' },
  { name: 'Blue',   bg: '#1565c0', text: '#90caf9', dim: 'rgba(21,101,192,0.18)' },
  { name: 'Green',  bg: '#2e7d32', text: '#a5d6a7', dim: 'rgba(46,125,50,0.18)' },
  { name: 'Gold',   bg: '#9a7e00', text: '#ffe082', dim: 'rgba(154,126,0,0.18)' },
  { name: 'Orange', bg: '#e65100', text: '#ffcc80', dim: 'rgba(230,81,0,0.18)' },
  { name: 'Purple', bg: '#6a1b9a', text: '#ce93d8', dim: 'rgba(106,27,154,0.18)' },
] as const;

const TEAM_SLOTS = [
  { slot: 1,  role: 'Top Order',       variant: null,    color: '#64b5f6' },
  { slot: 2,  role: 'Top Order',       variant: null,    color: '#64b5f6' },
  { slot: 3,  role: 'Top Order',       variant: null,    color: '#64b5f6' },
  { slot: 4,  role: 'Top Order',       variant: null,    color: '#64b5f6' },
  { slot: 5,  role: 'Batting AR',      variant: 'Pace',  color: '#81c784' },
  { slot: 6,  role: 'Batting AR',      variant: 'Pace',  color: '#81c784' },
  { slot: 7,  role: 'Bowling AR',      variant: 'Spin',  color: '#ffb74d' },
  { slot: 8,  role: 'Bowling AR',      variant: 'Spin',  color: '#ffb74d' },
  { slot: 9,  role: 'Bowler',          variant: 'Spin',  color: '#ff8a65' },
  { slot: 10, role: 'Bowler',          variant: 'Pace',  color: '#ff8a65' },
  { slot: 11, role: 'Bowler',          variant: 'Pace',  color: '#ff8a65' },
  { slot: 12, role: 'Bat/Bowl AR',     variant: 'Spin',  color: '#ce93d8' },
  { slot: 13, role: 'Wicket Keeper',   variant: null,    color: '#80cbc4' },
] as const;

const MAX_PACKAGES = 5;
const FONT = 'Barlow Condensed, sans-serif';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeNewPackage(email: string, name: string): TeamPackage {
  return {
    packageId: `${email}_${Date.now()}`,
    coachEmail: email,
    coachName: name,
    packageName: 'Default',
    status: 'draft',
    shared: false,
    teams: TEAM_COLORS.map((tc, i) => ({
      teamIndex: i + 1,
      teamName: tc.name,
      slots: TEAM_SLOTS.map((s) => ({ slot: s.slot, playerRowIndex: null, playerName: '' })),
    })),
    savedAt: '',
  };
}

function teamFillCount(team: PackageTeam): number {
  return team.slots.filter((s) => !!s.playerRowIndex).length;
}

function playerYoyo(player: ScoutPlayer): number | null {
  const vals = player.coachEvals
    .map((e) => parseFloat(e.evaluation.fitness?.['Yo-Yo'] || ''))
    .filter((v) => !isNaN(v) && v > 0);
  return vals.length > 0 ? Math.min(...vals) : null;
}

function yoyoColor(yy: number | null): string {
  if (yy === null) return 'rgba(245,240,232,0.3)';
  if (yy >= 15.5) return '#81c784';
  if (yy >= 15.2) return '#ffb74d';
  return '#ef9a9a';
}

// ─── PackageCard ──────────────────────────────────────────────────────────────

function PackageCard({
  pkg,
  editable,
  requiredIds,
  onOpen,
}: {
  pkg: TeamPackage;
  editable: boolean;
  requiredIds: Set<number>;
  onOpen: () => void;
}) {
  const totalFilled = pkg.teams.reduce((s, t) => s + teamFillCount(t), 0);
  const totalPossible = pkg.teams.length * 13;
  const pickedIds = new Set(
    pkg.teams.flatMap((t) => t.slots.map((s) => s.playerRowIndex)).filter(Boolean) as number[]
  );
  const missingCount = requiredIds.size > 0
    ? [...requiredIds].filter((id) => !pickedIds.has(id)).length
    : 0;

  return (
    <div
      onClick={onOpen}
      style={{
        background: '#221515',
        border: '1px solid rgba(192,57,43,0.15)',
        borderRadius: 10,
        padding: '16px 20px',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(192,57,43,0.4)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(192,57,43,0.15)'; }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <span style={{ color: '#f5f0e8', fontFamily: FONT, fontWeight: 700, fontSize: 14 }}>{pkg.packageName}</span>
          {!editable && (
            <span style={{ color: 'rgba(245,240,232,0.35)', fontFamily: FONT, fontSize: 11, marginLeft: 8 }}>{pkg.coachName}</span>
          )}
        </div>
        <span style={{ color: totalFilled === totalPossible ? '#81c784' : 'rgba(245,240,232,0.3)', fontFamily: FONT, fontSize: 10, whiteSpace: 'nowrap' }}>
          {totalFilled}/{totalPossible} filled
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {pkg.teams.map((team, i) => {
          const tc = TEAM_COLORS[i];
          const filled = teamFillCount(team);
          return (
            <span key={i} style={{
              background: tc.dim, color: tc.text, borderRadius: 4,
              padding: '2px 8px', fontFamily: FONT, fontSize: 10, fontWeight: 700,
              border: `1px solid ${tc.bg}44`,
            }}>
              {team.teamName} {filled === 13 ? '✓' : `${filled}/13`}
            </span>
          );
        })}
      </div>

      {requiredIds.size > 0 && (
        <div className="mt-2">
          {missingCount > 0 ? (
            <span style={{ color: '#ffb74d', fontFamily: FONT, fontSize: 10, fontWeight: 700 }}>
              ⚠ {missingCount} required player{missingCount !== 1 ? 's' : ''} missing
            </span>
          ) : (
            <span style={{ color: '#81c784', fontFamily: FONT, fontSize: 10, fontWeight: 700 }}>
              ✓ All required players included
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          {pkg.savedAt ? (
            <span style={{ color: 'rgba(245,240,232,0.2)', fontFamily: FONT, fontSize: 10 }}>
              {new Date(pkg.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
            </span>
          ) : <span />}
          <span style={{
            background: pkg.shared ? 'rgba(129,199,132,0.12)' : 'rgba(255,255,255,0.04)',
            color: pkg.shared ? '#81c784' : 'rgba(245,240,232,0.22)',
            border: `1px solid ${pkg.shared ? 'rgba(129,199,132,0.25)' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: 4, padding: '2px 8px', fontFamily: FONT, fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
          }}>
            {pkg.shared ? '◉ Shared' : '◎ Private'}
          </span>
        </div>
        <span style={{
          background: editable ? 'rgba(200,168,75,0.15)' : 'rgba(255,255,255,0.06)',
          color: editable ? '#c8a84b' : 'rgba(245,240,232,0.4)',
          borderRadius: 4, padding: '2px 10px', fontFamily: FONT, fontSize: 10, fontWeight: 700,
        }}>
          {editable ? 'Edit →' : 'View →'}
        </span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TeamSelectionBoard({
  players,
  user,
  sheetKey,
  initialSubView = 'list',
}: {
  players: ScoutPlayer[];
  user: AppUser;
  sheetKey: string;
  initialSubView?: 'list' | 'admin';
}) {
  // ── State (ALL hooks before any conditional return) ──
  const [packages, setPackages] = useState<TeamPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [subView, setSubView] = useState<'list' | 'edit' | 'compare' | 'admin'>(initialSubView);
  const [editPkg, setEditPkg] = useState<TeamPackage | null>(null);
  const [isEditable, setIsEditable] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [picker, setPicker] = useState<{ teamIndex: number; slot: number } | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [compareFilter, setCompareFilter] = useState<'all' | 'consensus' | 'majority' | 'unique'>('all');
  const [dragOver, setDragOver] = useState<{ teamIndex: number; slot: number } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const myPackages = useMemo(
    () => packages.filter((p) => p.coachEmail === user.email),
    [packages, user.email]
  );
  const otherPackages = useMemo(
    () => packages.filter((p) => p.coachEmail !== user.email),
    [packages, user.email]
  );
  const coachGroups = useMemo(() => {
    const map = new Map<string, { coachName: string; pkgs: TeamPackage[] }>();
    for (const pkg of otherPackages) {
      if (!map.has(pkg.coachEmail)) map.set(pkg.coachEmail, { coachName: pkg.coachName, pkgs: [] });
      map.get(pkg.coachEmail)!.pkgs.push(pkg);
    }
    return Array.from(map.values());
  }, [otherPackages]);

  const usedMap = useMemo(() => {
    const map = new Map<number, { teamIndex: number; teamName: string; slot: number }>();
    if (!editPkg) return map;
    for (const team of editPkg.teams) {
      for (const s of team.slots) {
        if (s.playerRowIndex) map.set(s.playerRowIndex, { teamIndex: team.teamIndex, teamName: team.teamName, slot: s.slot });
      }
    }
    return map;
  }, [editPkg]);

  const pickerPlayers = useMemo(() => {
    const q = pickerSearch.toLowerCase();
    if (!q) return players;
    return players.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.batch.toLowerCase().includes(q) ||
      p.div.toLowerCase().includes(q) ||
      (p.extraInfo?.['Primary Skill'] || '').toLowerCase().includes(q)
    );
  }, [players, pickerSearch]);

  // Players who MUST appear in at least one team: Pre- category + green Yo-Yo (≥15.5)
  const requiredPlayers = useMemo(
    () => players.filter((p) => {
      if (!p.category.startsWith('Pre-')) return false;
      const yy = playerYoyo(p);
      return yy !== null && yy >= 15.5;
    }),
    [players]
  );

  const requiredIds = useMemo(
    () => new Set(requiredPlayers.map((p) => p.rowIndex)),
    [requiredPlayers]
  );

  // Required players not present in any slot of the package being edited
  const missingRequired = useMemo(() => {
    if (!editPkg) return requiredPlayers;
    const pickedIds = new Set(
      editPkg.teams.flatMap((t) => t.slots.map((s) => s.playerRowIndex)).filter(Boolean) as number[]
    );
    return requiredPlayers.filter((p) => !pickedIds.has(p.rowIndex));
  }, [editPkg, requiredPlayers]);

  // All coaches grouped (admin only — admins receive all packages from the API)
  const allCoachGroups = useMemo(() => {
    const map = new Map<string, { coachName: string; coachEmail: string; pkgs: TeamPackage[] }>();
    for (const pkg of packages) {
      if (!map.has(pkg.coachEmail)) map.set(pkg.coachEmail, { coachName: pkg.coachName, coachEmail: pkg.coachEmail, pkgs: [] });
      map.get(pkg.coachEmail)!.pkgs.push(pkg);
    }
    return Array.from(map.values());
  }, [packages]);

  const compareData = useMemo(() => {
    const totalPkgs = packages.length;
    const freq = new Map<number, { player: ScoutPlayer; count: number; coaches: string[] }>();
    for (const pkg of packages) {
      const seenInPkg = new Set<number>();
      for (const team of pkg.teams) {
        for (const s of team.slots) {
          if (!s.playerRowIndex || seenInPkg.has(s.playerRowIndex)) continue;
          seenInPkg.add(s.playerRowIndex);
          const player = players.find((p) => p.rowIndex === s.playerRowIndex);
          if (!player) continue;
          if (!freq.has(s.playerRowIndex)) freq.set(s.playerRowIndex, { player, count: 0, coaches: [] });
          const entry = freq.get(s.playerRowIndex)!;
          entry.count++;
          if (!entry.coaches.includes(pkg.coachName)) entry.coaches.push(pkg.coachName);
        }
      }
    }
    return { items: Array.from(freq.values()).sort((a, b) => b.count - a.count), totalPkgs };
  }, [packages, players]);

  // ── Fetch ──
  const fetchPackages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/scout/team-packages?sheetKey=${encodeURIComponent(sheetKey)}`);
      const data = await res.json();
      if (data.packages) setPackages(data.packages);
      if (data.isAdmin !== undefined) setIsAdmin(!!data.isAdmin);
    } catch {}
    setLoading(false);
  }, [sheetKey]);

  useEffect(() => { fetchPackages(); }, [fetchPackages]);

  // ── Actions ──
  const openEdit = useCallback((pkg: TeamPackage | null, editable: boolean) => {
    const p = pkg ?? makeNewPackage(user.email, user.name);
    setEditPkg(JSON.parse(JSON.stringify(p)));
    setIsEditable(editable);
    setDirty(!pkg);
    setSubView('edit');
    setPicker(null);
    setPickerSearch('');
    setSaveError('');
    setConfirmDelete(false);
  }, [user]);

  function goBack() {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    setSubView('list');
    setEditPkg(null);
    setDirty(false);
    setPicker(null);
  }

  function updatePkg(updater: (pkg: TeamPackage) => TeamPackage) {
    setEditPkg((prev) => (prev ? updater(prev) : prev));
    setDirty(true);
  }

  function assignPlayer(player: ScoutPlayer) {
    if (!picker) return;
    const { teamIndex, slot } = picker;
    updatePkg((pkg) => ({
      ...pkg,
      teams: pkg.teams.map((t) =>
        t.teamIndex !== teamIndex ? t : {
          ...t,
          slots: t.slots.map((s) => s.slot !== slot ? s : { ...s, playerRowIndex: player.rowIndex, playerName: player.name }),
        }
      ),
    }));
    setPicker(null);
    setPickerSearch('');
  }

  function clearSlot(teamIndex: number, slot: number) {
    updatePkg((pkg) => ({
      ...pkg,
      teams: pkg.teams.map((t) =>
        t.teamIndex !== teamIndex ? t : {
          ...t,
          slots: t.slots.map((s) => s.slot !== slot ? s : { ...s, playerRowIndex: null, playerName: '' }),
        }
      ),
    }));
  }

  async function handleSave() {
    if (!editPkg) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(`/api/scout/team-packages?sheetKey=${encodeURIComponent(sheetKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: editPkg.packageId, packageName: editPkg.packageName, shared: editPkg.shared, teams: editPkg.teams }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error || 'Failed to save'); return; }
      setDirty(false);
      await fetchPackages();
    } catch (e: any) {
      setSaveError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editPkg) return;
    setSaving(true);
    try {
      await fetch(
        `/api/scout/team-packages?sheetKey=${encodeURIComponent(sheetKey)}&packageId=${encodeURIComponent(editPkg.packageId)}`,
        { method: 'DELETE' }
      );
      setSubView('list');
      setEditPkg(null);
      setDirty(false);
      await fetchPackages();
    } catch {}
    setSaving(false);
    setConfirmDelete(false);
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span style={{ color: 'rgba(245,240,232,0.35)', fontFamily: FONT }}>Loading packages…</span>
      </div>
    );
  }

  // ── Admin view ──
  if (subView === 'admin' && isAdmin) {
    const sharedCount = packages.filter((p) => p.shared).length;
    return (
      <div>
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <h2 style={{ color: '#f5f0e8', fontFamily: FONT, fontSize: 20, fontWeight: 700, margin: 0 }}>
            All Packages
          </h2>
          <span style={{ color: 'rgba(245,240,232,0.35)', fontFamily: FONT, fontSize: 12 }}>
            {packages.length} package{packages.length !== 1 ? 's' : ''} · {sharedCount} shared
          </span>
        </div>

        {allCoachGroups.map(({ coachName, coachEmail, pkgs }) => (
          <div key={coachEmail} className="mb-7">
            <div className="flex items-center gap-3 mb-3">
              <span style={{ color: '#f5f0e8', fontFamily: FONT, fontSize: 13, fontWeight: 700 }}>{coachName}</span>
              <span style={{ color: 'rgba(245,240,232,0.25)', fontFamily: FONT, fontSize: 11 }}>{coachEmail}</span>
              <span style={{ color: 'rgba(245,240,232,0.2)', fontFamily: FONT, fontSize: 11 }}>
                {pkgs.filter((p) => p.shared).length}/{pkgs.length} shared
              </span>
            </div>

            <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(192,57,43,0.2)' }}>
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#2a1818', borderBottom: '2px solid rgba(192,57,43,0.3)' }}>
                    {['Package', 'Teams', 'Fill', 'Visibility', 'Saved'].map((h) => (
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
                  {pkgs.map((pkg, i) => {
                    const totalFilled = pkg.teams.reduce((s, t) => s + teamFillCount(t), 0);
                    const totalPossible = pkg.teams.length * 13;
                    const isOwn = pkg.coachEmail === user.email;
                    return (
                      <tr key={pkg.packageId}
                        onClick={() => openEdit(pkg, isOwn)}
                        style={{
                          background: i % 2 === 0 ? '#1e1212' : '#1a1010',
                          borderBottom: '1px solid rgba(192,57,43,0.06)',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(192,57,43,0.07)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? '#1e1212' : '#1a1010'; }}>
                        <td style={{ padding: '9px 14px', fontFamily: FONT, fontSize: 12, fontWeight: 700, color: '#f5f0e8', whiteSpace: 'nowrap' }}>
                          {pkg.packageName}
                        </td>
                        <td style={{ padding: '9px 14px' }}>
                          <div className="flex flex-wrap gap-1">
                            {pkg.teams.map((t, ti) => {
                              const tc = TEAM_COLORS[ti];
                              return (
                                <span key={ti} style={{
                                  background: tc.dim, color: tc.text, borderRadius: 3,
                                  padding: '1px 6px', fontFamily: FONT, fontSize: 9, fontWeight: 700,
                                }}>
                                  {t.teamName}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td style={{ padding: '9px 14px', fontFamily: FONT, fontSize: 11, whiteSpace: 'nowrap',
                          color: totalFilled === totalPossible ? '#81c784' : 'rgba(245,240,232,0.4)' }}>
                          {totalFilled}/{totalPossible}
                        </td>
                        <td style={{ padding: '9px 14px' }}>
                          <span style={{
                            display: 'inline-block',
                            background: pkg.shared ? 'rgba(129,199,132,0.15)' : 'rgba(255,255,255,0.05)',
                            color: pkg.shared ? '#81c784' : 'rgba(245,240,232,0.35)',
                            border: `1px solid ${pkg.shared ? 'rgba(129,199,132,0.3)' : 'rgba(255,255,255,0.08)'}`,
                            borderRadius: 5, padding: '3px 10px',
                            fontFamily: FONT, fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                            whiteSpace: 'nowrap',
                          }}>
                            {pkg.shared ? '◉ Shared' : '◎ Private'}
                          </span>
                        </td>
                        <td style={{ padding: '9px 14px', fontFamily: FONT, fontSize: 11, color: 'rgba(245,240,232,0.3)', whiteSpace: 'nowrap' }}>
                          {pkg.savedAt
                            ? new Date(pkg.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {packages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(245,240,232,0.25)', fontFamily: FONT }}>
            No packages created yet.
          </div>
        )}
      </div>
    );
  }

  // ── Compare view ──
  if (subView === 'compare') {
    const { items, totalPkgs } = compareData;
    const filtered =
      compareFilter === 'consensus' ? items.filter((x) => x.count === totalPkgs) :
      compareFilter === 'majority'  ? items.filter((x) => x.count > 1 && x.count < totalPkgs) :
      compareFilter === 'unique'    ? items.filter((x) => x.count === 1) :
      items;

    const uniqueCoaches = new Set(packages.map((p) => p.coachEmail)).size;

    return (
      <div>
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button onClick={() => setSubView('list')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(245,240,232,0.5)', fontFamily: FONT, fontSize: 13 }}>
            ← Back
          </button>
          <h2 style={{ color: '#f5f0e8', fontFamily: FONT, fontSize: 20, fontWeight: 700, margin: 0 }}>
            Package Comparison
          </h2>
          <span style={{ color: 'rgba(245,240,232,0.35)', fontFamily: FONT, fontSize: 12 }}>
            {totalPkgs} package{totalPkgs !== 1 ? 's' : ''} · {uniqueCoaches} coach{uniqueCoaches !== 1 ? 'es' : ''}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {([
            ['all',       `All Players (${items.length})`],
            ['consensus', `In Every Package (${items.filter((x) => x.count === totalPkgs).length})`],
            ['majority',  `Shared (${items.filter((x) => x.count > 1 && x.count < totalPkgs).length})`],
            ['unique',    `Unique to One Coach (${items.filter((x) => x.count === 1).length})`],
          ] as [string, string][]).map(([key, label]) => {
            const active = compareFilter === key;
            return (
              <button key={key} onClick={() => setCompareFilter(key as typeof compareFilter)}
                style={{
                  fontFamily: FONT, fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
                  borderRadius: 6, padding: '6px 14px',
                  background: active ? 'rgba(200,168,75,0.22)' : 'rgba(255,255,255,0.04)',
                  color: active ? '#c8a84b' : 'rgba(245,240,232,0.4)',
                  border: `1px solid ${active ? '#c8a84b' : 'rgba(255,255,255,0.08)'}`,
                }}>
                {label}
              </button>
            );
          })}
        </div>

        <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(192,57,43,0.2)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#2a1818', borderBottom: '2px solid rgba(192,57,43,0.4)' }}>
                  {['Player', 'Batch', 'Div', 'Category', 'Primary Skill', 'Yo-Yo', 'In Packages', 'Coaches'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap"
                      style={{ fontFamily: FONT, color: h === 'In Packages' ? '#c8a84b' : 'rgba(245,240,232,0.55)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ player, count, coaches }, i) => {
                  const yy = playerYoyo(player);
                  const pct = totalPkgs > 0 ? count / totalPkgs : 0;
                  const barColor = pct === 1 ? '#81c784' : pct >= 0.5 ? '#ffb74d' : '#ef9a9a';
                  return (
                    <tr key={player.rowIndex}
                      style={{ background: i % 2 === 0 ? '#1e1212' : '#221515', borderBottom: '1px solid rgba(192,57,43,0.06)' }}>
                      <td className="px-3 py-2 font-bold whitespace-nowrap" style={{ color: '#f5f0e8', fontFamily: FONT }}>{player.name}</td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'rgba(245,240,232,0.45)', fontFamily: FONT }}>{player.batch || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'rgba(245,240,232,0.45)', fontFamily: FONT }}>{player.div || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'rgba(245,240,232,0.55)', fontFamily: FONT }}>{player.category || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'rgba(245,240,232,0.65)', fontFamily: FONT }}>{player.extraInfo?.['Primary Skill'] || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span style={{ color: yoyoColor(yy), fontFamily: FONT, fontWeight: 700, fontSize: 11 }}>
                          {yy !== null ? yy.toFixed(1) : '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span style={{ color: barColor, fontFamily: FONT, fontWeight: 700 }}>{count}/{totalPkgs}</span>
                          <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${pct * 100}%`, height: '100%', background: barColor, borderRadius: 2 }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2" style={{ color: 'rgba(245,240,232,0.55)', fontFamily: FONT, fontStyle: 'italic' }}>
                        {coaches.join(' · ')}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center" style={{ color: 'rgba(245,240,232,0.25)', fontFamily: FONT }}>
                      No players match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── Edit / View ──
  if (subView === 'edit' && editPkg) {
    const pickerComp = picker ? TEAM_SLOTS.find((s) => s.slot === picker.slot) : null;
    const pickerTeamIdx = picker ? editPkg.teams.findIndex((t) => t.teamIndex === picker.teamIndex) : -1;

    return (
      <div>
        {/* ── Header ── */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <button onClick={goBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(245,240,232,0.5)', fontFamily: FONT, fontSize: 13, padding: 0 }}>
            ← Back
          </button>

          {isEditable ? (
            <input
              value={editPkg.packageName}
              onChange={(e) => updatePkg((p) => ({ ...p, packageName: e.target.value }))}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(192,57,43,0.3)',
                borderRadius: 6, color: '#f5f0e8', fontFamily: FONT, fontSize: 16,
                fontWeight: 700, padding: '4px 10px', outline: 'none', letterSpacing: '0.04em',
              }}
            />
          ) : (
            <div>
              <span style={{ color: '#f5f0e8', fontFamily: FONT, fontSize: 16, fontWeight: 700 }}>{editPkg.packageName}</span>
              <span style={{ color: 'rgba(245,240,232,0.35)', fontFamily: FONT, fontSize: 12, marginLeft: 8 }}>by {editPkg.coachName}</span>
            </div>
          )}

          {isEditable && (
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              {dirty && <span style={{ color: 'rgba(200,168,75,0.7)', fontFamily: FONT, fontSize: 11 }}>Unsaved changes</span>}
              {saveError && <span style={{ color: '#ef9a9a', fontFamily: FONT, fontSize: 11 }}>{saveError}</span>}

              <button
                onClick={() => updatePkg((p) => ({ ...p, shared: !p.shared }))}
                style={{
                  background: editPkg.shared ? 'rgba(129,199,132,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${editPkg.shared ? 'rgba(129,199,132,0.35)' : 'rgba(255,255,255,0.1)'}`,
                  color: editPkg.shared ? '#81c784' : 'rgba(245,240,232,0.35)',
                  borderRadius: 6, padding: '6px 14px', fontFamily: FONT, fontSize: 11,
                  fontWeight: 700, letterSpacing: '0.06em', cursor: 'pointer',
                }}>
                {editPkg.shared ? '◉ Shared' : '◎ Private'}
              </button>

              <button onClick={handleSave} disabled={saving || !dirty}
                style={{
                  background: dirty && !saving ? 'rgba(46,125,50,0.35)' : 'rgba(46,125,50,0.1)',
                  border: `1px solid ${dirty && !saving ? 'rgba(46,125,50,0.6)' : 'rgba(46,125,50,0.15)'}`,
                  color: dirty && !saving ? '#a5d6a7' : 'rgba(165,214,167,0.25)',
                  borderRadius: 6, padding: '6px 16px', fontFamily: FONT, fontSize: 12,
                  fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                  cursor: dirty && !saving ? 'pointer' : 'not-allowed',
                }}>
                {saving ? 'Saving…' : 'Save Package'}
              </button>

              {confirmDelete ? (
                <>
                  <span style={{ color: '#ef9a9a', fontFamily: FONT, fontSize: 11 }}>Delete this package?</span>
                  <button onClick={handleDelete} disabled={saving}
                    style={{ background: 'rgba(192,57,43,0.4)', border: '1px solid rgba(192,57,43,0.7)', color: '#ef9a9a', borderRadius: 6, padding: '5px 12px', fontFamily: FONT, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    Yes, Delete
                  </button>
                  <button onClick={() => setConfirmDelete(false)}
                    style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(245,240,232,0.4)', borderRadius: 6, padding: '5px 12px', fontFamily: FONT, fontSize: 11, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </>
              ) : (
                <button onClick={() => setConfirmDelete(true)}
                  style={{ background: 'none', border: '1px solid rgba(192,57,43,0.2)', color: 'rgba(239,154,154,0.5)', borderRadius: 6, padding: '5px 12px', fontFamily: FONT, fontSize: 11, cursor: 'pointer' }}>
                  Delete
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Grid ── */}
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(192,57,43,0.2)' }}>
          <div className="overflow-x-auto">
            <table style={{ borderCollapse: 'collapse', minWidth: 860 }}>
              <thead>
                <tr style={{ background: '#2a1818', borderBottom: '2px solid rgba(192,57,43,0.4)' }}>
                  <th style={{ width: 30, padding: '8px 10px', color: 'rgba(245,240,232,0.25)', fontFamily: FONT, fontSize: 11, fontWeight: 700, textAlign: 'center' }}>#</th>
                  <th style={{ padding: '8px 12px', color: 'rgba(245,240,232,0.55)', fontFamily: FONT, fontSize: 11, fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap', minWidth: 90 }}>Role</th>
                  <th style={{ padding: '8px 8px', color: 'rgba(245,240,232,0.25)', fontFamily: FONT, fontSize: 10, fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap', minWidth: 42 }}>Type</th>
                  {editPkg.teams.map((team, ti) => {
                    const tc = TEAM_COLORS[ti];
                    const filled = teamFillCount(team);
                    return (
                      <th key={ti} style={{ padding: '8px 10px', textAlign: 'center', minWidth: 130 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          {isEditable ? (
                            <input
                              value={team.teamName}
                              onChange={(e) => updatePkg((p) => ({
                                ...p,
                                teams: p.teams.map((t) => t.teamIndex !== team.teamIndex ? t : { ...t, teamName: e.target.value }),
                              }))}
                              style={{
                                background: 'transparent', border: 'none',
                                borderBottom: `1px solid ${tc.text}55`,
                                color: tc.text, fontFamily: FONT, fontSize: 11, fontWeight: 700,
                                textAlign: 'center', outline: 'none', width: 100, letterSpacing: '0.06em',
                              }}
                            />
                          ) : (
                            <span style={{ color: tc.text, fontFamily: FONT, fontSize: 11, fontWeight: 700 }}>{team.teamName}</span>
                          )}
                          <span style={{ color: filled === 13 ? tc.text : 'rgba(245,240,232,0.2)', fontFamily: FONT, fontSize: 9 }}>
                            {filled}/13
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {TEAM_SLOTS.map((comp, ri) => (
                  <tr key={comp.slot}
                    style={{ background: ri % 2 === 0 ? '#1e1212' : '#1a1010', borderBottom: '1px solid rgba(192,57,43,0.06)' }}>
                    <td style={{ padding: '7px 10px', textAlign: 'center', color: 'rgba(245,240,232,0.25)', fontFamily: FONT, fontSize: 11 }}>
                      {comp.slot}
                    </td>
                    <td style={{ padding: '7px 12px', whiteSpace: 'nowrap', color: comp.color, fontFamily: FONT, fontSize: 11, fontWeight: 700 }}>
                      {comp.role}
                    </td>
                    <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>
                      {comp.variant && (
                        <span style={{
                          background: 'rgba(255,255,255,0.05)', color: 'rgba(245,240,232,0.35)',
                          fontFamily: FONT, fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
                          padding: '2px 5px', borderRadius: 3,
                        }}>
                          {comp.variant}
                        </span>
                      )}
                    </td>
                    {editPkg.teams.map((team, ti) => {
                      const slotData = team.slots.find((s) => s.slot === comp.slot);
                      const hasPlayer = !!slotData?.playerRowIndex;
                      const tc = TEAM_COLORS[ti];
                      const isDragTarget = isEditable && dragOver?.teamIndex === team.teamIndex && dragOver?.slot === comp.slot;
                      return (
                        <td key={ti}
                          onClick={() => isEditable && setPicker({ teamIndex: team.teamIndex, slot: comp.slot })}
                          onDragOver={(e) => { if (isEditable) { e.preventDefault(); setDragOver({ teamIndex: team.teamIndex, slot: comp.slot }); } }}
                          onDragLeave={() => setDragOver(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOver(null);
                            if (!isEditable) return;
                            const rowIdx = parseInt(e.dataTransfer.getData('playerRowIndex'), 10);
                            if (!rowIdx || usedMap.has(rowIdx)) return;
                            const player = players.find((p) => p.rowIndex === rowIdx);
                            if (!player) return;
                            updatePkg((pkg) => ({
                              ...pkg,
                              teams: pkg.teams.map((t) =>
                                t.teamIndex !== team.teamIndex ? t : {
                                  ...t,
                                  slots: t.slots.map((s) => s.slot !== comp.slot ? s : { ...s, playerRowIndex: player.rowIndex, playerName: player.name }),
                                }
                              ),
                            }));
                          }}
                          style={{
                            padding: '5px 8px', minWidth: 130, maxWidth: 170,
                            cursor: isEditable ? 'pointer' : 'default',
                            outline: isDragTarget ? '2px dashed rgba(255,183,77,0.6)' : 'none',
                            outlineOffset: -2,
                            background: isDragTarget ? 'rgba(255,183,77,0.12)' : 'transparent',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={(e) => { if (isEditable && !isDragTarget) (e.currentTarget as HTMLElement).style.background = 'rgba(192,57,43,0.08)'; }}
                          onMouseLeave={(e) => { if (!isDragTarget) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {hasPlayer ? (
                              <>
                                <span style={{ color: '#f5f0e8', fontFamily: FONT, fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {slotData!.playerName}
                                </span>
                                {isEditable && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); clearSlot(team.teamIndex, comp.slot); }}
                                    title="Remove player"
                                    style={{ background: 'none', border: 'none', color: 'rgba(245,240,232,0.2)', cursor: 'pointer', fontSize: 11, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>
                                    ✕
                                  </button>
                                )}
                              </>
                            ) : (
                              <span style={{
                                color: isEditable ? `${tc.text}33` : 'rgba(245,240,232,0.1)',
                                fontFamily: FONT, fontStyle: 'italic', fontSize: 10,
                              }}>
                                {isEditable ? 'pick player' : '—'}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Required players panel ── */}
        {requiredPlayers.length > 0 && (
          <div className="mt-4 rounded-lg border overflow-hidden" style={{
            borderColor: missingRequired.length > 0 ? 'rgba(255,183,77,0.3)' : 'rgba(129,199,132,0.25)',
            background: missingRequired.length > 0 ? 'rgba(255,183,77,0.06)' : 'rgba(129,199,132,0.06)',
          }}>
            <div className="flex items-center gap-2 px-4 py-2.5" style={{
              borderBottom: missingRequired.length > 0
                ? '1px solid rgba(255,183,77,0.2)'
                : '1px solid rgba(129,199,132,0.15)',
            }}>
              <span style={{ fontSize: 13 }}>{missingRequired.length > 0 ? '⚠' : '✓'}</span>
              <span style={{
                color: missingRequired.length > 0 ? '#ffb74d' : '#81c784',
                fontFamily: FONT, fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
              }}>
                {missingRequired.length > 0
                  ? `${missingRequired.length} required player${missingRequired.length !== 1 ? 's' : ''} who passed yo-yo not yet included`
                  : 'All required players included'}
              </span>
              <span style={{ color: 'rgba(245,240,232,0.25)', fontFamily: FONT, fontSize: 10, marginLeft: 4 }}>
                Pre- category · green Yo-Yo · must appear in at least one team
              </span>
              {isEditable && missingRequired.length > 0 && (
                <span style={{ color: 'rgba(245,240,232,0.2)', fontFamily: FONT, fontSize: 10, marginLeft: 'auto' }}>
                  drag to slot ↑
                </span>
              )}
            </div>
            {missingRequired.length > 0 && (
              <div className="flex flex-wrap gap-2 px-4 py-3">
                {missingRequired.map((player) => {
                  const yy = playerYoyo(player);
                  return (
                    <div
                      key={player.rowIndex}
                      draggable={isEditable}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('playerRowIndex', String(player.rowIndex));
                        e.dataTransfer.setData('playerName', player.name);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      style={{
                        background: 'rgba(255,183,77,0.1)', border: '1px solid rgba(255,183,77,0.2)',
                        borderRadius: 6, padding: '5px 10px',
                        cursor: isEditable ? 'grab' : 'default',
                        userSelect: 'none',
                      }}>
                      <span style={{ color: '#f5f0e8', fontFamily: FONT, fontWeight: 700, fontSize: 12 }}>{player.name}</span>
                      <span style={{ color: 'rgba(245,240,232,0.4)', fontFamily: FONT, fontSize: 10, marginLeft: 6 }}>
                        {player.batch} · {player.category}
                      </span>
                      {yy !== null && (
                        <span style={{ color: '#81c784', fontFamily: FONT, fontSize: 10, fontWeight: 700, marginLeft: 6 }}>
                          {yy.toFixed(1)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Player Picker Drawer ── */}
        {picker && isEditable && (
          <>
            <div
              onClick={() => { setPicker(null); setPickerSearch(''); }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 40 }}
            />
            <div style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, width: 320,
              background: '#1a1010', borderLeft: '1px solid rgba(192,57,43,0.28)',
              zIndex: 50, display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ padding: 16, borderBottom: '1px solid rgba(192,57,43,0.2)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#f5f0e8', fontFamily: FONT, fontWeight: 700, fontSize: 14 }}>
                    #{picker.slot} · {pickerComp?.role}
                    {pickerComp?.variant && <span style={{ color: 'rgba(245,240,232,0.45)', fontSize: 11, marginLeft: 6 }}>{pickerComp.variant}</span>}
                  </span>
                  <button onClick={() => { setPicker(null); setPickerSearch(''); }}
                    style={{ background: 'none', border: 'none', color: 'rgba(245,240,232,0.4)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>
                    ×
                  </button>
                </div>
                {pickerTeamIdx >= 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: TEAM_COLORS[pickerTeamIdx].text }}>
                      → {editPkg.teams.find((t) => t.teamIndex === picker.teamIndex)?.teamName} Team
                    </span>
                  </div>
                )}
                <input
                  autoFocus
                  placeholder="Search name, batch, skill…"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(192,57,43,0.25)', borderRadius: 6,
                    color: '#f5f0e8', fontFamily: FONT, fontSize: 12, padding: '7px 10px',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
                <div style={{ marginTop: 6, color: 'rgba(245,240,232,0.25)', fontFamily: FONT, fontSize: 10 }}>
                  {players.length - usedMap.size} available · {usedMap.size} used
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {pickerPlayers.map((player) => {
                  const inTeam = usedMap.get(player.rowIndex);
                  const yy = playerYoyo(player);
                  return (
                    <div
                      key={player.rowIndex}
                      onClick={() => !inTeam && assignPlayer(player)}
                      style={{
                        padding: '9px 16px',
                        borderBottom: '1px solid rgba(192,57,43,0.07)',
                        cursor: inTeam ? 'not-allowed' : 'pointer',
                        opacity: inTeam ? 0.4 : 1,
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => { if (!inTeam) (e.currentTarget as HTMLElement).style.background = 'rgba(192,57,43,0.1)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ color: '#f5f0e8', fontFamily: FONT, fontWeight: 700, fontSize: 12 }}>{player.name}</span>
                        {inTeam && (
                          <span style={{ color: 'rgba(245,240,232,0.4)', fontFamily: FONT, fontSize: 10, fontStyle: 'italic' }}>
                            {inTeam.teamName} #{inTeam.slot}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span style={{ color: 'rgba(245,240,232,0.4)', fontFamily: FONT, fontSize: 10 }}>
                          {player.batch || '—'} · {player.div || '—'}
                        </span>
                        {player.extraInfo?.['Primary Skill'] && (
                          <span style={{ color: 'rgba(245,240,232,0.6)', fontFamily: FONT, fontSize: 10 }}>
                            {player.extraInfo['Primary Skill']}
                          </span>
                        )}
                        {yy !== null && (
                          <span style={{ color: yoyoColor(yy), fontFamily: FONT, fontSize: 10, fontWeight: 700 }}>
                            {yy.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {pickerPlayers.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'rgba(245,240,232,0.25)', fontFamily: FONT, fontSize: 12 }}>
                    No players found.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── List view ──
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h2 style={{ color: '#f5f0e8', fontFamily: FONT, fontSize: 20, fontWeight: 700, margin: 0, flex: 1 }}>
          Team Packages
        </h2>
        {packages.length >= 2 && (
          <button
            onClick={() => { setSubView('compare'); setCompareFilter('all'); }}
            style={{
              background: 'rgba(200,168,75,0.12)', border: '1px solid rgba(200,168,75,0.25)',
              color: '#c8a84b', borderRadius: 6, padding: '7px 16px',
              fontFamily: FONT, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase', cursor: 'pointer',
            }}>
            ⊞ Compare All
          </button>
        )}
        {myPackages.length < MAX_PACKAGES && (
          <button
            onClick={() => openEdit(null, true)}
            style={{
              background: 'rgba(192,57,43,0.18)', border: '1px solid rgba(192,57,43,0.4)',
              color: '#ef9a9a', borderRadius: 6, padding: '7px 16px',
              fontFamily: FONT, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase', cursor: 'pointer',
            }}>
            + New Package
          </button>
        )}
      </div>

      {/* My Packages */}
      <section className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <h3 style={{ color: '#c8a84b', fontFamily: FONT, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
            My Packages
          </h3>
          <span style={{ color: 'rgba(245,240,232,0.2)', fontFamily: FONT, fontSize: 11 }}>
            {myPackages.length}/{MAX_PACKAGES}
          </span>
        </div>

        {myPackages.length === 0 ? (
          <div style={{
            background: '#221515', border: '1px dashed rgba(192,57,43,0.25)',
            borderRadius: 10, padding: '28px 20px', textAlign: 'center',
          }}>
            <p style={{ color: 'rgba(245,240,232,0.3)', fontFamily: FONT, fontSize: 13, margin: '0 0 12px' }}>
              You haven't created a package yet.
            </p>
            <button onClick={() => openEdit(null, true)}
              style={{
                background: 'rgba(192,57,43,0.2)', border: '1px solid rgba(192,57,43,0.4)',
                color: '#ef9a9a', borderRadius: 6, padding: '8px 20px',
                fontFamily: FONT, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', cursor: 'pointer',
              }}>
              Create Default Package
            </button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {myPackages.map((pkg) => (
              <PackageCard key={pkg.packageId} pkg={pkg} editable requiredIds={requiredIds} onOpen={() => openEdit(pkg, true)} />
            ))}
          </div>
        )}
      </section>

      {/* Other Coaches */}
      {otherPackages.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h3 style={{ color: 'rgba(245,240,232,0.35)', fontFamily: FONT, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
              Other Coaches
            </h3>
            <span style={{ color: 'rgba(245,240,232,0.2)', fontFamily: FONT, fontSize: 10 }}>
              {isAdmin ? 'all packages visible to admins' : 'shared packages only'}
            </span>
          </div>
          {coachGroups.map(({ coachName, pkgs }) => (
            <div key={coachName} className="mb-5">
              <div style={{ color: 'rgba(245,240,232,0.55)', fontFamily: FONT, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                {coachName}
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {pkgs.map((pkg) => (
                  <PackageCard key={pkg.packageId} pkg={pkg} editable={false} requiredIds={requiredIds} onOpen={() => openEdit(pkg, false)} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {packages.length === 0 && myPackages.length === 0 && (
        <div style={{
          background: '#221515', border: '1px solid rgba(192,57,43,0.1)',
          borderRadius: 10, padding: '24px 20px', textAlign: 'center', marginTop: 8,
        }}>
          <p style={{ color: 'rgba(245,240,232,0.2)', fontFamily: FONT, fontSize: 13, margin: 0 }}>
            No packages yet. Create the first one above.
          </p>
        </div>
      )}
    </div>
  );
}
