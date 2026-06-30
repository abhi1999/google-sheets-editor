'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ScoutPlayer } from '@/types/scout';
import type { AuditEntry } from '@/types';

const FONT = 'Barlow Condensed, sans-serif';

type Category = 'Fitness Score' | 'Tryout Evaluation' | 'In-Game Evaluation' | 'Other';

function categoryFor(column: string): Category {
  if (column === 'Fitness Score') return 'Fitness Score';
  if (column === 'Tryout Evaluation') return 'Tryout Evaluation';
  if (column.startsWith('In-Game Evaluation')) return 'In-Game Evaluation';
  return 'Other';
}

const CATEGORY_COLORS: Record<Category, { bg: string; text: string }> = {
  'Fitness Score': { bg: 'rgba(255,183,77,0.18)', text: '#ffb74d' },
  'Tryout Evaluation': { bg: 'rgba(144,202,249,0.18)', text: '#90caf9' },
  'In-Game Evaluation': { bg: 'rgba(128,203,196,0.18)', text: '#80cbc4' },
  Other: { bg: 'rgba(245,240,232,0.1)', text: 'rgba(245,240,232,0.5)' },
};

function valueStr(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

type ChangeRow = { path: string; old: string; new: string };

function flattenChanges(oldObj: unknown, newObj: unknown, prefix = ''): ChangeRow[] {
  const out: ChangeRow[] = [];
  const o = (oldObj && typeof oldObj === 'object' && !Array.isArray(oldObj) ? oldObj : {}) as Record<string, unknown>;
  const n = (newObj && typeof newObj === 'object' && !Array.isArray(newObj) ? newObj : {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(o), ...Object.keys(n)]);
  for (const k of keys) {
    const ov = o[k];
    const nv = n[k];
    const path = prefix ? `${prefix}.${k}` : k;
    const bothPlainObjects = ov && nv && typeof ov === 'object' && typeof nv === 'object' && !Array.isArray(ov) && !Array.isArray(nv);
    if (bothPlainObjects) {
      out.push(...flattenChanges(ov, nv, path));
    } else {
      const os = valueStr(ov);
      const ns = valueStr(nv);
      if (os !== ns) out.push({ path, old: os, new: ns });
    }
  }
  return out;
}

function safeParse(json: string): unknown {
  try { return JSON.parse(json); } catch { return json; }
}

type ChangesPopover = { x: number; y: number; rows: ChangeRow[] };

export function AuditLogTable({ players, sheetKey }: { players: ScoutPlayer[]; sheetKey: string }) {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');
  const [search, setSearch] = useState('');
  const [popover, setPopover] = useState<ChangesPopover | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/audit?sheetKey=${encodeURIComponent(sheetKey)}`);
      const data = await res.json();
      setEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch {}
    setLoading(false);
  }, [sheetKey]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const playerByRowIndex = useMemo(() => {
    const m = new Map<number, ScoutPlayer>();
    for (const p of players) m.set(p.rowIndex, p);
    return m;
  }, [players]);

  const rows = useMemo(
    () =>
      entries
        .filter((e) => categoryFor(e.column) !== 'Other')
        .map((e) => ({
          entry: e,
          category: categoryFor(e.column),
          player: playerByRowIndex.get(Number(e.rowIndex)) || null,
          changes: flattenChanges(safeParse(e.oldValue), safeParse(e.newValue)),
        })),
    [entries, playerByRowIndex]
  );

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      if (q) {
        const name = r.player?.name?.toLowerCase() || '';
        const coach = r.entry.userName?.toLowerCase() || '';
        if (!name.includes(q) && !coach.includes(q)) return false;
      }
      return true;
    });
  }, [rows, categoryFilter, search]);

  const categoryCounts = useMemo(() => {
    const m = new Map<Category, number>();
    for (const r of rows) m.set(r.category, (m.get(r.category) ?? 0) + 1);
    return m;
  }, [rows]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(245,240,232,0.4)', fontFamily: FONT }}>Loading…</div>;
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search player or coach…"
          className="text-xs px-3 py-1.5 rounded-md border"
          style={{ background: 'rgba(0,0,0,0.25)', color: '#f5f0e8', borderColor: 'rgba(245,240,232,0.15)', fontFamily: 'Barlow, sans-serif', minWidth: 200 }}
        />
        <div className="flex items-center gap-1">
          {(['all', 'Fitness Score', 'Tryout Evaluation', 'In-Game Evaluation'] as const).map((c) => {
            const active = categoryFilter === c;
            const cc = c === 'all' ? { bg: 'rgba(200,168,75,0.2)', text: '#c8a84b' } : CATEGORY_COLORS[c];
            const count = c === 'all' ? rows.length : (categoryCounts.get(c) ?? 0);
            return (
              <button key={c} onClick={() => setCategoryFilter(c)}
                style={{
                  padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                  fontFamily: FONT,
                  background: active ? cc.bg : 'rgba(255,255,255,0.05)',
                  color: active ? cc.text : 'rgba(245,240,232,0.4)',
                  border: `1px solid ${active ? 'transparent' : 'rgba(255,255,255,0.08)'}`,
                  cursor: 'pointer',
                }}>
                {c === 'all' ? 'All' : c}
                <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.7 }}>({count})</span>
              </button>
            );
          })}
        </div>
        <button onClick={fetchEntries} title="Refresh"
          style={{ padding: '3px 9px', borderRadius: 4, fontSize: 11, fontWeight: 700, fontFamily: FONT, background: 'rgba(255,255,255,0.05)', color: 'rgba(245,240,232,0.5)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
          ↻ Refresh
        </button>
        <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.3)', fontFamily: FONT }}>
          {filteredRows.length} entr{filteredRows.length !== 1 ? 'ies' : 'y'}
        </span>
      </div>

      {filteredRows.length === 0 ? (
        <div className="py-8 text-center" style={{ color: 'rgba(245,240,232,0.4)', fontFamily: FONT }}>
          No audit entries yet — they'll appear here as soon as a fitness score, tryout evaluation, or in-game rating is saved.
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(192,57,43,0.2)' }}>
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#2a1818', borderBottom: '2px solid rgba(192,57,43,0.3)' }}>
                {['Timestamp', 'Player', 'Category', 'Coach', 'Changes'].map((h) => (
                  <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontFamily: FONT, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.4)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({ entry, category, player, changes }, i) => {
                const cc = CATEGORY_COLORS[category];
                return (
                  <tr key={entry.id || i} style={{ background: i % 2 === 0 ? '#1e1212' : '#1a1010', borderBottom: '1px solid rgba(192,57,43,0.06)' }}>
                    <td style={{ padding: '9px 14px', fontFamily: FONT, fontSize: 11, color: 'rgba(245,240,232,0.45)', whiteSpace: 'nowrap' }}>
                      {entry.timestamp ? new Date(entry.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td style={{ padding: '9px 14px', fontFamily: FONT, fontSize: 12, fontWeight: 700, color: '#f5f0e8', whiteSpace: 'nowrap' }}>
                      {player?.name || `Row ${entry.rowIndex}`}
                    </td>
                    <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 700, color: cc.text, background: cc.bg, borderRadius: 3, padding: '2px 7px' }}>
                        {category}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px', fontFamily: FONT, fontSize: 11, color: 'rgba(245,240,232,0.5)', whiteSpace: 'nowrap' }}>
                      {entry.userName || entry.userEmail}
                    </td>
                    <td style={{ padding: '9px 14px', fontFamily: FONT, fontSize: 11, maxWidth: 320 }}>
                      {changes.length === 0 ? (
                        <span style={{ color: 'rgba(245,240,232,0.2)' }}>—</span>
                      ) : (
                        <button
                          onClick={(e) => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setPopover({ x: rect.left, y: rect.bottom + 6, rows: changes });
                          }}
                          style={{ background: 'none', border: 'none', color: 'rgba(245,240,232,0.6)', cursor: 'pointer', textAlign: 'left', padding: 0, fontFamily: FONT, fontSize: 11 }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#c8a84b'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(245,240,232,0.6)'; }}>
                          {changes.length} field{changes.length !== 1 ? 's' : ''} changed — view
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {popover && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: Math.min(popover.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 360),
            top: Math.min(popover.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 320),
            zIndex: 1000, background: '#1a1010', border: '1px solid rgba(200,168,75,0.35)', borderRadius: 8,
            padding: '12px 14px', minWidth: 280, maxWidth: 380, maxHeight: 320, overflow: 'auto',
            boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
          }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8 }}>
            <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: '#c8a84b' }}>What changed</span>
            <button onClick={() => setPopover(null)} style={{ background: 'none', border: 'none', color: 'rgba(245,240,232,0.4)', cursor: 'pointer', fontSize: 13 }}>✕</button>
          </div>
          {popover.rows.map((r, i) => (
            <div key={i} style={{ marginBottom: i < popover.rows.length - 1 ? 8 : 0 }}>
              <div style={{ fontFamily: FONT, fontSize: 10, fontWeight: 700, color: 'rgba(245,240,232,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                {r.path}
              </div>
              <div style={{ fontFamily: FONT, fontSize: 12, color: 'rgba(245,240,232,0.85)' }}>
                <span style={{ color: 'rgba(239,154,154,0.8)', textDecoration: 'line-through' }}>{r.old || '—'}</span>
                {' → '}
                <span style={{ color: '#a5d6a7' }}>{r.new || '—'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
