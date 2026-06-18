'use client';

import { useState, useMemo, useCallback } from 'react';
import type { ScoutPlayer, PlayerEvaluation } from '@/types/scout';
import {
  SCHEMAS,
  FITNESS_FIELDS,
  calcScore,
  getRating,
  playerInitials,
  type SectionDef,
} from '@/lib/scout-schemas';

// Column groupings for the player info panel
const INFO_GROUPS: { label: string; keys: string[] }[] = [
  {
    label: 'Profile',
    keys: ['Primary Skill', 'Batting hand', 'Bowler arm', 'Bowling type'],
  },
  {
    label: 'Batting',
    keys: ['Batting Order type', 'Bat Mat', 'Bat Inns', 'Bat Runs', 'Bat SR', 'Bat Avg'],
  },
  {
    label: 'Bowling',
    keys: ['Bowling Mat', 'Bowling Inns', 'Bowling-Overs', 'Runs given', 'Wkts', 'Econ', 'Bowling Avg', 'Bowling SR'],
  },
  {
    label: 'Fielding & Keeping',
    keys: ['Wk-Mat', 'Catches', 'WK Catches', 'Direct RO', 'InDirect RO', 'Stumpings'],
  },
];

const ALL_KNOWN_KEYS = new Set(INFO_GROUPS.flatMap((g) => g.keys));

function getDivStyleModal(div: string): { bg: string; text: string } | null {
  if (!div) return null;
  const d = div.trim().toUpperCase();
  if (d === 'A' || d === 'DIV A' || d === 'DIVISION A') return { bg: '#c8a84b', text: '#1a1a1a' };
  if (d === 'B' || d === 'DIV B' || d === 'DIVISION B') return { bg: '#546e7a', text: '#fff' };
  return { bg: '#5d4037', text: '#fff' };
}

function getCategoryColorModal(category: string): string {
  const c = category.toLowerCase();
  if (c.includes('wicket') || c.includes('keeper') || c.includes('wk')) return '#00695c';
  if (c.includes('allrounder') || c.includes('all-rounder') || c.includes('all rounder')) return '#6a1b9a';
  if (c.includes('batter') || c.includes('batsman')) return '#1565c0';
  if (c.includes('bowler')) return '#bf360c';
  return '#2e4030';
}

function getRatingCls(pct: number): string {
  if (pct >= 90) return 'must';
  if (pct >= 75) return 'highly';
  if (pct >= 60) return 'rec';
  if (pct >= 45) return 'cons';
  return 'no';
}

interface PlayerModalProps {
  player: ScoutPlayer;
  userEmail: string;
  onClose: () => void;
  onSave: (evaluation: PlayerEvaluation, remarks: string) => void;
  saving: boolean;
}

function SkillStars({
  skillName,
  value,
  onChange,
}: {
  skillName: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || value;

  return (
    <div className="flex gap-1 flex-shrink-0" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`text-2xl cursor-pointer select-none transition-all leading-none ${
            i <= display ? 'text-[#c8a84b]' : 'text-gray-300'
          } hover:scale-110`}
          onMouseEnter={() => setHovered(i)}
          onClick={() => { const v = i === value ? 0 : i; if (v === 0) setHovered(0); onChange(v); }}
          title={`${i} — ${['Poor', 'Below Average', 'Average', 'Good', 'Excellent'][i - 1]}`}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function RatingChip({ cls, label }: { cls: string; label: string }) {
  const colors: Record<string, string> = {
    must: 'bg-[#1b5e20] text-white',
    highly: 'bg-[#2e7d32] text-white',
    rec: 'bg-[#558b2f] text-white',
    cons: 'bg-[#f9a825] text-white',
    no: 'bg-[#c62828] text-white',
  };
  return (
    <span
      className={`font-[Barlow_Condensed,sans-serif] text-xs font-bold tracking-widest uppercase px-3 py-1 rounded ${colors[cls] || 'bg-gray-500 text-white'}`}
    >
      {label}
    </span>
  );
}

export function PlayerModal({ player, userEmail, onClose, onSave, saving }: PlayerModalProps) {
  const schema = SCHEMAS[player.schema];

  const [activeTab, setActiveTab] = useState<'mine' | 'all'>('mine');

  const [skills, setSkills] = useState<Record<string, number>>(
    () => ({ ...player.evaluation.skills })
  );
  const [notes, setNotes] = useState<Record<string, string>>(
    () => ({ ...player.evaluation.notes })
  );
  const [remarks, setRemarks] = useState(player.remarks);
  const [fitness, setFitness] = useState<Record<string, string>>(
    () => ({ ...player.evaluation.fitness })
  );
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([0]));
  const [fitnessOpen, setFitnessOpen] = useState(true);

  const { weighted, pct } = useMemo(
    () => calcScore({ skills, notes, fitness }, schema),
    [skills, notes, fitness, schema]
  );
  const rating = useMemo(() => getRating(pct), [pct]);

  const handleRate = useCallback((skillName: string, value: number) => {
    setSkills((prev) => ({ ...prev, [skillName]: value }));
  }, []);

  const handleNote = useCallback((skillName: string, value: string) => {
    setNotes((prev) => ({ ...prev, [skillName]: value }));
  }, []);

  const handleFitness = useCallback((field: string, value: string) => {
    setFitness((prev) => ({ ...prev, [field]: value }));
  }, []);

  const toggleSection = useCallback((idx: number) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const handleSave = () => {
    onSave({ skills, notes, fitness }, remarks);
  };

  const getSectionScore = (sec: SectionDef) => {
    let wScore = 0;
    let maxW = 0;
    sec.skills.forEach((sk) => {
      wScore += (skills[sk.name] || 0) * sk.weight;
      maxW += 5 * sk.weight;
    });
    return { wScore, maxW };
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-6 overflow-y-auto"
      style={{ background: 'rgba(8,18,8,0.88)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-xl w-full max-w-2xl my-auto shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: 'Barlow, sans-serif', color: '#1a1a1a' }}
      >
        {/* Modal header */}
        <div
          className="flex items-center gap-4 px-5 py-4 border-b-2 border-[#c0392b]"
          style={{ background: '#1a2e1a' }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold border-2 border-[#c0392b] flex-shrink-0"
            style={{
              background: getCategoryColorModal(player.category),
              color: '#fff',
              fontFamily: 'Barlow Condensed, sans-serif',
            }}
          >
            {playerInitials(player.name)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                className="text-xl font-extrabold uppercase tracking-wide"
                style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#f5f0e8' }}
              >
                {player.name}
              </h2>
              {(() => {
                const ds = getDivStyleModal(player.div);
                return ds ? (
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0"
                    style={{ background: ds.bg, color: ds.text, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.06em' }}
                  >
                    {player.div}
                  </span>
                ) : null;
              })()}
            </div>
            <p
              className="text-xs font-semibold uppercase tracking-widest mt-0.5"
              style={{ color: '#c8a84b', fontFamily: 'Barlow Condensed, sans-serif' }}
            >
              {player.schema} · {player.category}
            </p>
          </div>
          <button
            className="ml-auto text-2xl leading-none cursor-pointer transition-colors"
            style={{ color: 'rgba(245,240,232,0.4)', background: 'none', border: 'none' }}
            onClick={onClose}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#f5f0e8')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(245,240,232,0.4)')}
          >
            ✕
          </button>
        </div>

        {/* Player info — structured groups */}
        {Object.keys(player.extraInfo).length > 0 && (() => {
          const EXCLUDED_KEYS = new Set(['Academy', 'Batting order', 'Special Request']);
          const info = Object.fromEntries(
            Object.entries(player.extraInfo).filter(([k]) => !EXCLUDED_KEYS.has(k))
          );
          const unknownEntries = Object.entries(info).filter(([k]) => !ALL_KNOWN_KEYS.has(k));

          const renderStat = (key: string, val: string) => (
            <div key={key} className="flex flex-col min-w-0">
              <span
                className="text-[0.6rem] font-bold uppercase tracking-widest leading-none mb-0.5"
                style={{ color: 'rgba(200,168,75,0.55)', fontFamily: 'Barlow Condensed, sans-serif' }}
              >
                {key}
              </span>
              <span
                className="text-xs font-semibold truncate"
                style={{ color: '#f5f0e8', fontFamily: 'Barlow, sans-serif' }}
              >
                {val}
              </span>
            </div>
          );

          return (
            <div style={{ background: '#1a2a1a', borderBottom: '1px solid rgba(200,168,75,0.15)' }}>
              {INFO_GROUPS.map((group) => {
                const entries = group.keys
                  .map((k) => [k, info[k]] as [string, string])
                  .filter(([, v]) => v);
                if (entries.length === 0) return null;
                return (
                  <div key={group.label} className="px-5 py-2.5 border-b"
                    style={{ borderColor: 'rgba(200,168,75,0.1)' }}>
                    <div
                      className="text-[0.65rem] font-bold uppercase tracking-widest mb-2"
                      style={{ color: '#c8a84b', fontFamily: 'Barlow Condensed, sans-serif', opacity: 0.7 }}
                    >
                      {group.label}
                    </div>
                    <div className="grid gap-x-5 gap-y-2"
                      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))' }}>
                      {entries.map(([k, v]) => renderStat(k, v))}
                    </div>
                  </div>
                );
              })}
              {unknownEntries.length > 0 && (
                <div className="px-5 py-2.5">
                  <div className="grid gap-x-5 gap-y-2"
                    style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
                    {unknownEntries.map(([k, v]) => renderStat(k, v))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Tab bar */}
        <div className="flex border-b" style={{ background: '#1a2e1a', borderColor: 'rgba(192,57,43,0.3)' }}>
          {(['mine', 'all'] as const).map((tab) => {
            const label = tab === 'mine'
              ? 'My Evaluation'
              : `${player.coachEvals.length} Coach${player.coachEvals.length !== 1 ? 'es' : ''}${player.aggregatePct > 0 ? ` · avg ${player.aggregatePct}%` : ''}`;
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex-shrink-0"
                style={{
                  fontFamily: 'Barlow Condensed, sans-serif',
                  color: isActive ? '#f5f0e8' : 'rgba(245,240,232,0.45)',
                  borderColor: isActive ? '#c0392b' : 'transparent',
                  background: 'none',
                  letterSpacing: '0.08em',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* My Evaluation tab */}
        {activeTab === 'mine' && (
          <>
            {/* Score bar */}
            <div
              className="flex flex-wrap items-center gap-4 px-5 py-2.5 border-b"
              style={{ background: '#243324', borderColor: 'rgba(200,168,75,0.2)' }}
            >
              <span style={{ fontFamily: 'Barlow Condensed, sans-serif', color: 'rgba(245,240,232,0.6)', fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                <strong className="text-[#c8a84b] text-base mr-1">{weighted}</strong>
                / {schema.maxScore} pts
              </span>
              <span style={{ fontFamily: 'Barlow Condensed, sans-serif', color: 'rgba(245,240,232,0.6)', fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                <strong className="text-[#c8a84b] text-base mr-1">{pct}%</strong>
              </span>
              <div className="ml-auto">
                <RatingChip cls={rating.cls} label={rating.label} />
              </div>
            </div>

            {/* Scoring guide */}
            <div
              className="px-5 py-2 text-xs border-b flex flex-wrap gap-x-4 gap-y-0.5"
              style={{ background: '#f8f6f2', color: '#4a4a4a', borderColor: '#eee' }}
            >
              {['1 = Poor', '2 = Below Average', '3 = Average', '4 = Good', '5 = Excellent'].map((g) => (
                <span key={g}>{g}</span>
              ))}
            </div>

            {/* Evaluation sections */}
            <div className="overflow-y-auto" style={{ maxHeight: '55vh' }}>
              {schema.sections.map((sec, si) => {
                const { wScore, maxW } = getSectionScore(sec);
                const isOpen = openSections.has(si);
                return (
                  <div key={si} className="border-b" style={{ borderColor: '#eee' }}>
                    {/* Section header */}
                    <button
                      className="w-full flex items-center gap-2.5 px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                      style={{ background: '#f8f6f2', border: 'none', textAlign: 'left' }}
                      onClick={() => toggleSection(si)}
                    >
                      <span
                        className="text-[0.68rem] font-bold uppercase tracking-widest text-white px-1.5 py-0.5 rounded-sm flex-shrink-0"
                        style={{ background: '#2c1810', fontFamily: 'Barlow Condensed, sans-serif' }}
                      >
                        {sec.letter}
                      </span>
                      <span
                        className="font-bold uppercase tracking-wide text-sm"
                        style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#1a1a1a' }}
                      >
                        {sec.name}
                      </span>
                      {wScore > 0 && (
                        <span
                          className="text-sm font-bold ml-auto mr-2"
                          style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#4a4a4a' }}
                        >
                          {wScore}/{maxW}
                        </span>
                      )}
                      <span
                        className="text-xs ml-auto transition-transform duration-200 flex-shrink-0"
                        style={{
                          color: '#4a4a4a',
                          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          marginLeft: wScore > 0 ? '0' : 'auto',
                        }}
                      >
                        ▼
                      </span>
                    </button>

                    {/* Skill rows */}
                    {isOpen && (
                      <div className="py-1">
                        {sec.skills.map((skill) => (
                          <div
                            key={skill.name}
                            className="px-5 py-2.5 border-b last:border-b-0"
                            style={{ borderColor: '#f0f0f0' }}
                          >
                            <div className="flex items-start gap-3 mb-1.5">
                              <div className="flex-1 min-w-0">
                                <div
                                  className="text-sm font-bold uppercase tracking-wide leading-tight"
                                  style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#1a1a1a' }}
                                >
                                  {skill.name}
                                </div>
                                <div className="text-xs mt-0.5 leading-snug" style={{ color: '#4a4a4a' }}>
                                  {skill.desc}
                                </div>
                              </div>
                              <span
                                className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
                                style={{
                                  fontFamily: 'Barlow Condensed, sans-serif',
                                  color: '#4a4a4a',
                                  background: '#efefef',
                                }}
                              >
                                ×{skill.weight}
                              </span>
                              <SkillStars
                                skillName={skill.name}
                                value={skills[skill.name] || 0}
                                onChange={(v) => handleRate(skill.name, v)}
                              />
                            </div>
                            <textarea
                              className="w-full border rounded text-xs px-2.5 py-1.5 resize-none focus:outline-none focus:border-[#1a2e1a] transition-colors"
                              style={{
                                borderColor: '#e5e5e5',
                                background: '#fafafa',
                                color: '#1a1a1a',
                                minHeight: '36px',
                                maxHeight: '72px',
                                fontFamily: 'Barlow, sans-serif',
                              }}
                              placeholder="Add a note…"
                              rows={1}
                              value={notes[skill.name] || ''}
                              onChange={(e) => handleNote(skill.name, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Fitness */}
              <div className="border-b" style={{ borderColor: '#eee' }}>
                <button
                  className="w-full flex items-center gap-2.5 px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  style={{ background: '#f8f6f2', border: 'none', textAlign: 'left' }}
                  onClick={() => setFitnessOpen((o) => !o)}
                >
                  <span
                    className="text-[0.68rem] font-bold uppercase tracking-widest text-white px-1.5 py-0.5 rounded-sm flex-shrink-0"
                    style={{ background: '#8b1a1a', fontFamily: 'Barlow Condensed, sans-serif' }}
                  >
                    FIT
                  </span>
                  <span
                    className="font-bold uppercase tracking-wide text-sm"
                    style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#1a1a1a' }}
                  >
                    Fitness Assessment
                  </span>
                  {FITNESS_FIELDS.some((f) => fitness[f]) && (
                    <span className="text-xs ml-auto mr-2" style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#4a4a4a' }}>
                      {FITNESS_FIELDS.filter((f) => fitness[f]).length}/{FITNESS_FIELDS.length} filled
                    </span>
                  )}
                  <span
                    className="text-xs flex-shrink-0 transition-transform duration-200"
                    style={{ color: '#4a4a4a', transform: fitnessOpen ? 'rotate(180deg)' : 'rotate(0deg)', marginLeft: FITNESS_FIELDS.some((f) => fitness[f]) ? '0' : 'auto' }}
                  >
                    ▼
                  </span>
                </button>
                {fitnessOpen && (
                  <div className="py-1">
                    <div className="px-5 py-3 grid gap-x-5 gap-y-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                      {FITNESS_FIELDS.map((field) => (
                        <div key={field} className="flex flex-col gap-1">
                          <label
                            className="text-[0.68rem] font-bold uppercase tracking-widest"
                            style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#4a4a4a' }}
                          >
                            {field}
                          </label>
                          <input
                            type="text"
                            className="border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#1a4040] transition-colors"
                            style={{ borderColor: '#e5e5e5', background: '#fafafa', color: '#1a1a1a', fontFamily: 'Barlow, sans-serif' }}
                            placeholder="—"
                            value={fitness[field] || ''}
                            onChange={(e) => handleFitness(field, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Remarks */}
              <div className="px-5 py-4">
                <div
                  className="text-sm font-bold uppercase tracking-widest mb-2"
                  style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#1a1a1a' }}
                >
                  Overall Remarks / Recommendation
                </div>
                <textarea
                  className="w-full border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#1a2e1a] transition-colors resize-y"
                  style={{
                    borderColor: '#ddd',
                    background: '#fafafa',
                    color: '#1a1a1a',
                    minHeight: '72px',
                    fontFamily: 'Barlow, sans-serif',
                  }}
                  placeholder="Overall impression, standout moments, areas for development…"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
                {/* Rating guide chips */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {[
                    { cls: 'must', label: '90–100% Must Select' },
                    { cls: 'highly', label: '75–89% Highly Recommended' },
                    { cls: 'rec', label: '60–74% Recommended' },
                    { cls: 'cons', label: '45–59% Consider' },
                    { cls: 'no', label: '<45% Not Recommended' },
                  ].map((r) => (
                    <RatingChip key={r.cls} cls={r.cls} label={r.label} />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* All Coaches tab */}
        {activeTab === 'all' && (
          <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
            {player.coachEvals.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm font-semibold" style={{ color: 'rgba(26,26,26,0.4)', fontFamily: 'Barlow Condensed, sans-serif' }}>
                  No coaches have submitted evaluations yet.
                </p>
              </div>
            ) : (
              <>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#f8f6f2', borderBottom: '1px solid #eee' }}>
                    {['Coach', 'Score', 'Rating', 'Remarks', 'Saved'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-widest"
                        style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#4a4a4a' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {player.coachEvals.map((ev, i) => {
                    const isMe = ev.coachEmail.toLowerCase() === userEmail.toLowerCase();
                    return (
                      <tr key={i}
                        style={{
                          background: isMe ? 'rgba(200,168,75,0.06)' : i % 2 === 0 ? '#fff' : '#fafafa',
                          borderBottom: '1px solid #f0f0f0',
                        }}>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-sm" style={{ color: '#1a1a1a', fontFamily: 'Barlow Condensed, sans-serif' }}>
                            {ev.coachName || ev.coachEmail}
                            {isMe && <span className="ml-1.5 text-[10px] font-bold" style={{ color: '#c8a84b' }}>YOU</span>}
                          </div>
                          <div className="text-xs" style={{ color: '#aaa' }}>{ev.coachEmail}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-base" style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#1a2e1a' }}>
                            {ev.pct}%
                          </span>
                          <div className="text-xs" style={{ color: '#aaa' }}>{ev.score} pts</div>
                        </td>
                        <td className="px-4 py-3">
                          <RatingChip cls={getRatingCls(ev.pct)} label={ev.rating} />
                        </td>
                        <td className="px-4 py-3 max-w-[180px]">
                          <span className="text-xs" style={{ color: '#4a4a4a' }}>{ev.remarks || '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs" style={{ color: '#aaa', whiteSpace: 'nowrap' }}>
                            {ev.savedAt ? new Date(ev.savedAt).toLocaleDateString() : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Fitness values — listed per coach, not averaged */}
              {player.coachEvals.some((ev) =>
                FITNESS_FIELDS.some((f) => ev.evaluation.fitness?.[f])
              ) && (
                <div className="border-t" style={{ borderColor: '#eee' }}>
                  <div
                    className="px-4 py-2 text-[0.65rem] font-bold uppercase tracking-widest"
                    style={{ background: '#f8f6f2', fontFamily: 'Barlow Condensed, sans-serif', color: '#4a4a4a' }}
                  >
                    Fitness Assessment
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ background: '#f8f6f2', borderBottom: '1px solid #eee' }}>
                          <th className="px-4 py-2 text-left font-bold uppercase tracking-widest"
                            style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#4a4a4a', minWidth: '120px' }}>
                            Coach
                          </th>
                          {FITNESS_FIELDS.map((f) => (
                            <th key={f} className="px-3 py-2 text-left font-bold uppercase tracking-widest"
                              style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#4a4a4a', minWidth: '80px', whiteSpace: 'nowrap' }}>
                              {f}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {player.coachEvals.map((ev, i) => {
                          const hasFitness = FITNESS_FIELDS.some((f) => ev.evaluation.fitness?.[f]);
                          if (!hasFitness) return null;
                          const isMe = ev.coachEmail.toLowerCase() === userEmail.toLowerCase();
                          return (
                            <tr key={i} style={{
                              background: isMe ? 'rgba(200,168,75,0.06)' : i % 2 === 0 ? '#fff' : '#fafafa',
                              borderBottom: '1px solid #f0f0f0',
                            }}>
                              <td className="px-4 py-2.5 font-semibold"
                                style={{ color: '#1a1a1a', fontFamily: 'Barlow Condensed, sans-serif' }}>
                                {ev.coachName || ev.coachEmail}
                                {isMe && (
                                  <span className="ml-1.5 text-[10px] font-bold" style={{ color: '#c8a84b' }}>YOU</span>
                                )}
                              </td>
                              {FITNESS_FIELDS.map((f) => (
                                <td key={f} className="px-3 py-2.5"
                                  style={{ color: ev.evaluation.fitness?.[f] ? '#1a1a1a' : '#ccc' }}>
                                  {ev.evaluation.fitness?.[f] || '—'}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t"
          style={{ background: '#fafafa', borderColor: '#eee' }}
        >
          <button
            className="font-bold uppercase tracking-wider text-sm px-5 py-2 rounded-md transition-all hover:opacity-80 hover:-translate-y-px cursor-pointer"
            style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              background: '#e8e0d0',
              color: '#4a4a4a',
              border: 'none',
            }}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          {activeTab === 'mine' && (
            <button
              className="font-bold uppercase tracking-wider text-sm px-5 py-2 rounded-md transition-all hover:opacity-85 hover:-translate-y-px cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                fontFamily: 'Barlow Condensed, sans-serif',
                background: '#1a2e1a',
                color: '#f5f0e8',
                border: 'none',
              }}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Evaluation'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
