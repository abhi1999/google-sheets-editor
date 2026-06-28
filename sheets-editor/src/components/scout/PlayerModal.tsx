'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { ScoutPlayer, PlayerEvaluation, SchemaType } from '@/types/scout';
import {
  SCHEMAS,
  FITNESS_FIELDS,
  calcScore,
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

function getYoYoBadge(coachEvals: ScoutPlayer['coachEvals']): { best: number; bg: string; text: string } | null {
  const vals = coachEvals
    .map((e) => parseFloat(e.evaluation.fitness?.['Yo-Yo'] || ''))
    .filter((v) => !isNaN(v) && v > 0);
  if (vals.length === 0) return null;
  const best = Math.max(...vals);
  if (best >= 15.5) return { best, bg: '#1b5e20', text: '#a5d6a7' };
  if (best >= 15.2) return { best, bg: '#7f3f00', text: '#ffcc80' };
  return { best, bg: '#7f1f1f', text: '#ef9a9a' };
}

function getRatingCls(pct: number): string {
  if (pct >= 90) return 'must';
  if (pct >= 75) return 'highly';
  if (pct >= 60) return 'rec';
  if (pct >= 45) return 'cons';
  return 'no';
}

function getSchemaColor(schema: SchemaType): string {
  if (schema === 'Batsman') return '#1565c0';
  if (schema === 'Fast Bowler') return '#bf360c';
  return '#6a1b9a';
}

interface PlayerModalProps {
  player: ScoutPlayer;
  userEmail: string;
  onClose: () => void;
  onSave: (evaluation: PlayerEvaluation, remarks: string) => void;
  saving: boolean;
  isAdmin?: boolean;
  isSelected?: boolean;
  selectionSaving?: boolean;
  onToggleSelection?: (selected: boolean) => void;
}

export function SkillStars({
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

export function PlayerModal({ player, userEmail, onClose, onSave, saving, isAdmin, isSelected, selectionSaving, onToggleSelection }: PlayerModalProps) {
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
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set());
  const [fitnessOpen, setFitnessOpen] = useState(true);
  // Collapsible everywhere so coaches can tuck it away and focus on skill evaluations —
  // collapsed by default on mobile (least screen to spare), open by default on desktop.
  const [infoOpen, setInfoOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    if (mq.matches) setInfoOpen(false);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const schemaScores = useMemo(
    () => (Object.entries(SCHEMAS) as [SchemaType, typeof SCHEMAS[SchemaType]][]).map(([name, def]) => {
      const { weighted, pct } = calcScore({ skills, notes, fitness }, def);
      return { name: name as SchemaType, weighted, maxScore: def.maxScore, pct };
    }),
    [skills, notes, fitness]
  );

  const handleRate = useCallback((skillName: string, value: number) => {
    setSkills((prev) => ({ ...prev, [skillName]: value }));
  }, []);

  const handleNote = useCallback((skillName: string, value: string) => {
    setNotes((prev) => ({ ...prev, [skillName]: value }));
  }, []);

  const handleFitness = useCallback((field: string, value: string) => {
    setFitness((prev) => ({ ...prev, [field]: value }));
  }, []);

  const toggleSection = useCallback((key: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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
      className="fixed inset-0 z-50 flex md:items-start md:justify-center md:p-6 md:overflow-y-auto"
      style={{
        background: 'rgba(8,18,8,0.88)', backdropFilter: 'blur(4px)',
        alignItems: isMobile ? 'flex-end' : undefined,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-t-2xl md:rounded-xl w-full md:max-w-2xl md:my-auto shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: 'Barlow, sans-serif', color: '#1a1a1a', ...(isMobile ? { height: '92dvh' } : {}) }}
      >
        {/* Drag handle — mobile only */}
        {isMobile && (
          <div className="flex-shrink-0 flex justify-center pt-3 pb-1">
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }} />
          </div>
        )}
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
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <p
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: '#c8a84b', fontFamily: 'Barlow Condensed, sans-serif' }}
              >
                {player.category}
              </p>
              {(() => {
                const yoyo = getYoYoBadge(player.coachEvals);
                return yoyo ? (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded"
                    style={{ background: yoyo.bg, color: yoyo.text, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.06em' }}
                  >
                    YO-YO {yoyo.best}
                  </span>
                ) : (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded"
                    style={{ background: 'rgba(245,240,232,0.08)', color: 'rgba(245,240,232,0.25)', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.06em' }}
                  >
                    YO-YO —
                  </span>
                );
              })()}
            </div>
          </div>
          {isSelected !== undefined && (
            <button
              onClick={isAdmin && !selectionSaving ? () => onToggleSelection?.(!isSelected) : undefined}
              title={isAdmin ? (isSelected ? 'Click to deselect' : 'Click to select') : (isSelected ? 'Selected' : 'Not selected')}
              style={{
                marginLeft: 'auto',
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 11px', borderRadius: 6,
                fontSize: 11, fontWeight: 800,
                fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.08em',
                background: isSelected ? 'rgba(27,94,32,0.5)' : 'rgba(255,255,255,0.06)',
                color: isSelected ? '#a5d6a7' : 'rgba(245,240,232,0.3)',
                border: `1px solid ${isSelected ? 'rgba(46,125,50,0.7)' : 'rgba(245,240,232,0.12)'}`,
                cursor: isAdmin && !selectionSaving ? 'pointer' : 'default',
                flexShrink: 0,
                opacity: selectionSaving ? 0.5 : 1,
                transition: 'all 0.15s',
              }}
            >
              {isSelected ? '✓ Selected' : '○ Not Selected'}
            </button>
          )}
          <button
            className="text-2xl leading-none cursor-pointer transition-colors"
            style={{ color: 'rgba(245,240,232,0.4)', background: 'none', border: 'none', marginLeft: isSelected !== undefined ? 8 : 'auto' }}
            onClick={onClose}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#f5f0e8')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(245,240,232,0.4)')}
          >
            ✕
          </button>
        </div>

        {/* Player info — structured groups */}
        {Object.keys(player.extraInfo).length > 0 && (() => {
          // Matched case/whitespace-insensitively since these are raw sheet column headers —
          // double spaces, non-breaking spaces, and casing differences would otherwise slip through.
          const normalizeKey = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
          const EXCLUDED_KEYS = new Set(
            ['Academy', 'Batting order', 'Special Request', 'Team', 'CC Bat lookup', 'CC bowl lookup', 'CC ID']
              .map(normalizeKey)
          );
          const info = Object.fromEntries(
            Object.entries(player.extraInfo).filter(([k]) => !EXCLUDED_KEYS.has(normalizeKey(k)))
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

          const body = (
            <div className="px-5 py-2 flex flex-wrap gap-x-6 gap-y-3">
              {INFO_GROUPS.map((group) => {
                const entries = group.keys
                  .map((k) => [k, info[k]] as [string, string])
                  .filter(([, v]) => v);
                if (entries.length === 0) return null;
                return (
                  <div key={group.label} className="flex items-baseline gap-x-4 gap-y-1.5 flex-wrap">
                    <span
                      className="text-[0.55rem] font-bold uppercase tracking-widest flex-shrink-0"
                      style={{ color: '#c8a84b', fontFamily: 'Barlow Condensed, sans-serif', opacity: 0.6 }}
                    >
                      {group.label}
                    </span>
                    {entries.map(([k, v]) => renderStat(k, v))}
                  </div>
                );
              })}
              {unknownEntries.map(([k, v]) => renderStat(k, v))}
            </div>
          );

          // Collapsible on every screen size so coaches can tuck profile info away and
          // focus on skill evaluations — collapsed by default on mobile, open on desktop.
          return (
            <div style={{ background: '#1a2a1a', borderBottom: '1px solid rgba(200,168,75,0.15)' }}>
              <button
                className="w-full flex items-center gap-2 px-5 py-2"
                style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                onClick={() => setInfoOpen((o) => !o)}
              >
                <span
                  className="text-[0.6rem] font-bold uppercase tracking-widest"
                  style={{ color: '#c8a84b', fontFamily: 'Barlow Condensed, sans-serif', opacity: 0.7 }}
                >
                  Player Info
                </span>
                <span
                  className="text-xs flex-shrink-0 transition-transform duration-200 ml-auto"
                  style={{ color: 'rgba(245,240,232,0.4)', transform: infoOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  ▼
                </span>
              </button>
              {infoOpen && body}
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

        {/* Tab content — single scroll container on mobile, transparent wrapper on desktop */}
        <div className="flex-1 min-h-0 overflow-y-auto md:flex-none md:overflow-visible">

        {/* My Evaluation tab */}
        {activeTab === 'mine' && (
          <>
            {/* Per-schema score bar */}
            <div
              className="flex flex-wrap items-center gap-5 px-5 py-2.5 border-b"
              style={{ background: '#243324', borderColor: 'rgba(200,168,75,0.2)' }}
            >
              {schemaScores.map(({ name, weighted, maxScore, pct }) => (
                <div key={name} className="flex items-center gap-2">
                  <span
                    className="text-[0.6rem] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm flex-shrink-0"
                    style={{ background: getSchemaColor(name), color: '#fff', fontFamily: 'Barlow Condensed, sans-serif' }}
                  >
                    {name === 'Batsman' ? 'BAT' : name === 'Fast Bowler' ? 'FB' : 'SB'}
                  </span>
                  <span style={{ fontFamily: 'Barlow Condensed, sans-serif', color: 'rgba(245,240,232,0.6)', fontSize: '0.8rem' }}>
                    <strong className="text-[#c8a84b] text-base mr-1">{pct}%</strong>
                    <span className="text-xs opacity-60">{weighted}/{maxScore}</span>
                  </span>
                </div>
              ))}
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

            {/* Evaluation sections — all 3 schemas */}
            <div className="overflow-y-auto" style={{ maxHeight: isMobile ? 'none' : '55vh' }}>
              {(Object.entries(SCHEMAS) as [SchemaType, (typeof SCHEMAS)[SchemaType]][]).map(([schemaName, schemaDef]) => (
                <div key={schemaName}>
                  {/* Schema group header */}
                  <div
                    className="px-5 py-1.5 text-[0.7rem] font-bold uppercase tracking-widest"
                    style={{
                      background: getSchemaColor(schemaName),
                      color: '#fff',
                      fontFamily: 'Barlow Condensed, sans-serif',
                      letterSpacing: '0.12em',
                    }}
                  >
                    {schemaName}
                  </div>
                  {schemaDef.sections.map((sec, si) => {
                    const key = `${schemaName}-${si}`;
                    const { wScore, maxW } = getSectionScore(sec);
                    const isOpen = openSections.has(key);
                    return (
                      <div key={key} className="border-b" style={{ borderColor: '#eee' }}>
                        {/* Section header */}
                        <button
                          className="w-full flex items-center gap-2.5 px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                          style={{ background: '#f8f6f2', border: 'none', textAlign: 'left' }}
                          onClick={() => toggleSection(key)}
                        >
                          <span
                            className="text-[0.68rem] font-bold uppercase tracking-widest text-white px-1.5 py-0.5 rounded-sm flex-shrink-0"
                            style={{ background: getSchemaColor(schemaName), fontFamily: 'Barlow Condensed, sans-serif' }}
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
                            className="text-xs transition-transform duration-200 flex-shrink-0"
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
                </div>
              ))}

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
              </div>
            </div>
          </>
        )}

        {/* All Coaches tab */}
        {activeTab === 'all' && (
          <div className="overflow-y-auto" style={{ maxHeight: isMobile ? 'none' : '60vh' }}>
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
                    <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-widest"
                      style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#4a4a4a' }}>
                      Coach
                    </th>
                    {(Object.keys(SCHEMAS) as SchemaType[]).map((s) => (
                      <th key={s} className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-widest"
                        style={{ fontFamily: 'Barlow Condensed, sans-serif', color: getSchemaColor(s) }}>
                        {s === 'Batsman' ? 'BAT' : s === 'Fast Bowler' ? 'FB' : 'SB'}
                      </th>
                    ))}
                    <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-widest"
                      style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#4a4a4a' }}>
                      Remarks
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-widest"
                      style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#4a4a4a' }}>
                      Saved
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {player.coachEvals.map((ev, i) => {
                    const isMe = ev.coachEmail.toLowerCase() === userEmail.toLowerCase();
                    const evSchemaScores = (Object.entries(SCHEMAS) as [SchemaType, (typeof SCHEMAS)[SchemaType]][]).map(
                      ([name, def]) => ({ name, pct: calcScore(ev.evaluation, def).pct })
                    );
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
                        {evSchemaScores.map(({ name, pct }) => (
                          <td key={name} className="px-3 py-3">
                            <span className="font-bold text-sm" style={{ fontFamily: 'Barlow Condensed, sans-serif', color: pct > 0 ? getSchemaColor(name) : '#ccc' }}>
                              {pct > 0 ? `${pct}%` : '—'}
                            </span>
                          </td>
                        ))}
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

        </div>{/* end tab content scroll wrapper */}

        {/* Footer */}
        <div
          className="flex-shrink-0 flex items-center justify-end gap-2.5 px-5 py-3.5 border-t"
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
