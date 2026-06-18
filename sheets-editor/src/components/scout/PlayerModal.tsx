'use client';

import { useState, useMemo, useCallback } from 'react';
import type { ScoutPlayer, PlayerEvaluation } from '@/types/scout';
import {
  SCHEMAS,
  calcScore,
  getRating,
  playerInitials,
  type SectionDef,
} from '@/lib/scout-schemas';

interface PlayerModalProps {
  player: ScoutPlayer;
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
          onClick={() => onChange(i)}
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

export function PlayerModal({ player, onClose, onSave, saving }: PlayerModalProps) {
  const schema = SCHEMAS[player.schema];

  const [skills, setSkills] = useState<Record<string, number>>(
    () => ({ ...player.evaluation.skills })
  );
  const [notes, setNotes] = useState<Record<string, string>>(
    () => ({ ...player.evaluation.notes })
  );
  const [remarks, setRemarks] = useState(player.remarks);
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([0]));

  const { weighted, pct } = useMemo(
    () => calcScore({ skills, notes }, schema),
    [skills, notes, schema]
  );
  const rating = useMemo(() => getRating(pct), [pct]);

  const handleRate = useCallback((skillName: string, value: number) => {
    setSkills((prev) => ({ ...prev, [skillName]: value }));
  }, []);

  const handleNote = useCallback((skillName: string, value: string) => {
    setNotes((prev) => ({ ...prev, [skillName]: value }));
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
    onSave({ skills, notes }, remarks);
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
          className="flex items-center gap-4 px-5 py-4 border-b-2 border-[#c8a84b]"
          style={{ background: '#1a2e1a' }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold border-2 border-[#c8a84b] flex-shrink-0"
            style={{
              background: '#2e4030',
              color: '#f5f0e8',
              fontFamily: 'Barlow Condensed, sans-serif',
            }}
          >
            {playerInitials(player.name)}
          </div>
          <div>
            <h2
              className="text-xl font-extrabold uppercase tracking-wide"
              style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#f5f0e8' }}
            >
              {player.name}
            </h2>
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
                    style={{ background: '#1a2e1a', fontFamily: 'Barlow Condensed, sans-serif' }}
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
        </div>
      </div>
    </div>
  );
}
