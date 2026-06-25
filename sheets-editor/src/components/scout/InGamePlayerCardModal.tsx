'use client';

import { useState, useEffect, useMemo } from 'react';
import type { ScoutPlayer, InGameRatingRecord, InGameRating, WkEvent, FieldingEntry, CatchDroppedEntry } from '@/types/scout';
import { playerInitials } from '@/lib/scout-schemas';
import { BATTING_SKILL_SECTIONS, FAST_BOWLING_SKILL_SECTIONS, SPIN_BOWLING_SKILL_SECTIONS } from '@/lib/ingame-schemas';
import type { InGameSkillSection } from '@/lib/ingame-schemas';

const FONT = 'Barlow Condensed, sans-serif';

function StaticStars({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="text-sm leading-none" style={{ color: i <= value ? '#c8a84b' : '#ddd' }}>★</span>
      ))}
    </span>
  );
}

function SkillList({ skills, sections }: { skills: Record<string, number>; sections: InGameSkillSection[] }) {
  return (
    <div className="px-5 py-2">
      {sections.map((sec) => {
        const rated = sec.skills.filter((sk) => (skills[sk.name] || 0) > 0);
        if (rated.length === 0) return null;
        return (
          <div key={sec.letter} className="mb-2 last:mb-0">
            <div className="text-[0.65rem] font-bold uppercase tracking-widest mb-1" style={{ fontFamily: FONT, color: '#8a8a8a' }}>
              {sec.letter}. {sec.name}
            </div>
            {rated.map((sk) => (
              <div key={sk.name} className="flex items-center justify-between gap-3 py-1">
                <span className="text-xs font-bold uppercase tracking-wide" style={{ fontFamily: FONT, color: '#1a1a1a' }}>{sk.name}</span>
                <StaticStars value={skills[sk.name] || 0} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function CatchesDroppedLine({ entries, label }: { entries: CatchDroppedEntry[]; label: string }) {
  if (entries.length === 0) return null;
  const total = entries.reduce((s, e) => s + (e.count || 0), 0);
  return (
    <div className="px-5 py-1.5 text-xs" style={{ color: '#4a4a4a' }}>
      <strong style={{ color: '#1a1a1a' }}>{label}:</strong> {total} dropped
      {entries.some((e) => e.note) && (
        <span> — {entries.filter((e) => e.note).map((e) => e.note).join('; ')}</span>
      )}
    </div>
  );
}

function WkEventsLine({ events }: { events: WkEvent[] }) {
  if (events.length === 0) return null;
  const byes = events.filter((e) => e.type === 'Bye').reduce((s, e) => s + (e.runs || 0), 0);
  const missed = events.filter((e) => e.type === 'MissedCatch').reduce((s, e) => s + (e.count || 0), 0);
  return (
    <div className="px-5 py-1.5 text-xs" style={{ color: '#4a4a4a' }}>
      {byes > 0 && <span><strong style={{ color: '#1a1a1a' }}>Byes conceded:</strong> {byes}{'  '}</span>}
      {missed > 0 && <span><strong style={{ color: '#1a1a1a' }}>Missed catches:</strong> {missed}</span>}
    </div>
  );
}

function FieldingEntriesLine({ entries }: { entries: FieldingEntry[] }) {
  if (entries.length === 0) return null;
  const saved = entries.filter((e) => e.type === 'Saved').reduce((s, e) => s + e.runs, 0);
  const conceded = entries.filter((e) => e.type === 'Conceded').reduce((s, e) => s + e.runs, 0);
  const dropped = entries.filter((e) => e.type === 'CatchDropped').length;
  return (
    <div className="px-5 py-1.5 text-xs" style={{ color: '#4a4a4a' }}>
      {saved > 0 && <span><strong style={{ color: '#1a1a1a' }}>Runs saved:</strong> {saved}{'  '}</span>}
      {conceded > 0 && <span><strong style={{ color: '#1a1a1a' }}>Runs conceded:</strong> {conceded}{'  '}</span>}
      {dropped > 0 && <span><strong style={{ color: '#1a1a1a' }}>Catches dropped:</strong> {dropped}</span>}
    </div>
  );
}

function NotesLine({ value }: { value: string }) {
  if (!value.trim()) return null;
  return (
    <div className="px-5 py-1.5 text-xs italic" style={{ color: '#4a4a4a' }}>
      &ldquo;{value}&rdquo;
    </div>
  );
}

function hasSkillValue(skills: Record<string, number>): boolean {
  return Object.values(skills).some((v) => v > 0);
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b last:border-b-0" style={{ borderColor: '#eee' }}>
      <div className="px-5 py-1.5 text-xs font-bold uppercase tracking-widest" style={{ fontFamily: FONT, color: '#fff', background: '#2e4030' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function RatingRecordCard({ record, teamName, isMe, onDelete }: { record: InGameRatingRecord; teamName: string; isMe: boolean; onDelete?: (id: string) => void }) {
  const r: InGameRating = record.rating;
  return (
    <div className="rounded-lg border mb-3 overflow-hidden" style={{ borderColor: '#e5e5e5' }}>
      <div className="flex items-center justify-between px-5 py-2" style={{ background: '#f8f6f2' }}>
        <span className="text-sm font-bold" style={{ fontFamily: FONT, color: '#1a1a1a' }}>
          Game {record.gameNumber} · {teamName}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: '#4a4a4a' }}>
            {record.coachName}{isMe ? ' (You)' : ''} · {record.savedAt ? new Date(record.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
          </span>
          {isMe && onDelete && (
            <button
              onClick={() => onDelete(record.id)}
              className="text-xs font-bold uppercase px-2 py-0.5 rounded flex-shrink-0"
              style={{ fontFamily: FONT, background: 'rgba(192,57,43,0.1)', color: '#c0392b', border: '1px solid rgba(192,57,43,0.3)' }}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {r.battedThisGame && (hasSkillValue(r.battingSkills) || r.battingCatchesDropped.length > 0 || r.battingNotes.trim()) && (
        <SectionBlock title="Batting">
          <SkillList skills={r.battingSkills} sections={BATTING_SKILL_SECTIONS} />
          <CatchesDroppedLine entries={r.battingCatchesDropped} label="Catches dropped off batting" />
          <NotesLine value={r.battingNotes} />
        </SectionBlock>
      )}

      {r.bowledFast && (
        <SectionBlock title="Fast Bowling">
          <SkillList skills={r.fastBowlingSkills} sections={FAST_BOWLING_SKILL_SECTIONS} />
          <CatchesDroppedLine entries={r.fastBowlingCatchesDropped} label="Catches dropped off bowling" />
          <NotesLine value={r.fastBowlingNotes} />
        </SectionBlock>
      )}

      {r.bowledSpin && (
        <SectionBlock title="Spin Bowling">
          <SkillList skills={r.spinBowlingSkills} sections={SPIN_BOWLING_SKILL_SECTIONS} />
          <CatchesDroppedLine entries={r.spinBowlingCatchesDropped} label="Catches dropped off bowling" />
          <NotesLine value={r.spinBowlingNotes} />
        </SectionBlock>
      )}

      {r.keptWicket && (
        <SectionBlock title="Wicket Keeping">
          <WkEventsLine events={r.wkEvents} />
          <NotesLine value={r.wkNotes} />
        </SectionBlock>
      )}

      {(r.fieldingEntries.length > 0 || r.fieldingNotes.trim()) && (
        <SectionBlock title="Fielding">
          <FieldingEntriesLine entries={r.fieldingEntries} />
          <NotesLine value={r.fieldingNotes} />
        </SectionBlock>
      )}

      {r.overallNotes.trim() && (
        <SectionBlock title="Overall">
          <NotesLine value={r.overallNotes} />
        </SectionBlock>
      )}
    </div>
  );
}

interface InGamePlayerCardModalProps {
  player: ScoutPlayer;
  ratings: InGameRatingRecord[];
  userEmail: string;
  teamNameFor: (teamIndex: number) => string;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

const INFO_FIELDS: { label: string; key: string }[] = [
  { label: 'Primary Skill', key: 'Primary Skill' },
  { label: 'Batting Hand', key: 'Batting hand' },
  { label: 'Bowling Arm', key: 'Bowler arm' },
  { label: 'Bowling Profile', key: 'Bowling type' },
];

export function InGamePlayerCardModal({ player, ratings, userEmail, teamNameFor, onDelete, onClose }: InGamePlayerCardModalProps) {
  const [activeTab, setActiveTab] = useState<'mine' | 'all'>('mine');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const playerRatings = useMemo(
    () => ratings.filter((r) => r.playerRowIndex === player.rowIndex).sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
    [ratings, player.rowIndex]
  );
  const myRatings = useMemo(
    () => playerRatings.filter((r) => r.coachEmail.toLowerCase() === userEmail.toLowerCase()),
    [playerRatings, userEmail]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex md:items-start md:justify-center md:p-6 md:overflow-y-auto"
      style={{ background: 'rgba(8,18,8,0.88)', backdropFilter: 'blur(4px)', alignItems: isMobile ? 'flex-end' : undefined }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-t-2xl md:rounded-xl w-full md:max-w-2xl md:my-auto shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: 'Barlow, sans-serif', color: '#1a1a1a', ...(isMobile ? { height: '92dvh' } : {}) }}
      >
        {isMobile && (
          <div className="flex-shrink-0 flex justify-center pt-3 pb-1">
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }} />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-4 px-5 py-4 border-b-2 border-[#c0392b]" style={{ background: '#1a2e1a' }}>
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold border-2 border-[#c0392b] flex-shrink-0"
            style={{ background: '#2e4030', color: '#fff', fontFamily: FONT }}
          >
            {playerInitials(player.name)}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold uppercase tracking-wide" style={{ fontFamily: FONT, color: '#f5f0e8' }}>
              {player.name}
            </h2>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#c8a84b', fontFamily: FONT }}>
              {player.category}
            </p>
          </div>
          <button
            className="text-2xl leading-none cursor-pointer transition-colors"
            style={{ color: 'rgba(245,240,232,0.4)', background: 'none', border: 'none', marginLeft: 'auto' }}
            onClick={onClose}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#f5f0e8')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(245,240,232,0.4)')}
          >
            ✕
          </button>
        </div>

        {/* Self-declared skill info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-5 py-3 border-b" style={{ background: '#f8f6f2', borderColor: '#eee' }}>
          {INFO_FIELDS.map((f) => (
            <div key={f.key}>
              <div className="text-[0.65rem] font-bold uppercase tracking-widest" style={{ fontFamily: FONT, color: '#4a4a4a' }}>
                {f.label}
              </div>
              <div className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>
                {player.extraInfo?.[f.key]?.trim() || '—'}
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex flex-shrink-0 border-b" style={{ borderColor: '#eee' }}>
          {(['mine', 'all'] as const).map((tab) => {
            const label = tab === 'mine' ? `My Ratings (${myRatings.length})` : `All Coaches (${playerRatings.length})`;
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex-shrink-0"
                style={{
                  fontFamily: FONT,
                  color: isActive ? '#1a1a1a' : 'rgba(26,26,26,0.45)',
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

        {/* Tab content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4" style={{ background: '#fff' }}>
          {(activeTab === 'mine' ? myRatings : playerRatings).length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-semibold" style={{ color: 'rgba(26,26,26,0.4)', fontFamily: FONT }}>
                {activeTab === 'mine' ? 'You haven’t rated this player yet.' : 'No in-game ratings submitted yet.'}
              </p>
            </div>
          ) : (
            (activeTab === 'mine' ? myRatings : playerRatings).map((r) => (
              <RatingRecordCard
                key={r.id}
                record={r}
                teamName={teamNameFor(r.teamIndex)}
                isMe={r.coachEmail.toLowerCase() === userEmail.toLowerCase()}
                onDelete={onDelete}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-end gap-2.5 px-5 py-3.5 border-t" style={{ background: '#fafafa', borderColor: '#eee' }}>
          <button
            className="font-bold uppercase tracking-wider text-sm px-5 py-2 rounded-md transition-all hover:opacity-80 hover:-translate-y-px cursor-pointer"
            style={{ fontFamily: FONT, background: '#e8e0d0', color: '#4a4a4a', border: 'none' }}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
