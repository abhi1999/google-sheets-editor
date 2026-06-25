'use client';

import { useState, useEffect } from 'react';
import type { ScoutPlayer, InGameRating, InGameRatingPayload, WkEvent, WkEventType, FieldingEntry, FieldingEntryType, CatchDroppedEntry } from '@/types/scout';
import { playerInitials } from '@/lib/scout-schemas';
import { BATTING_SKILL_SECTIONS, FAST_BOWLING_SKILL_SECTIONS, SPIN_BOWLING_SKILL_SECTIONS, emptyInGameRating } from '@/lib/ingame-schemas';
import type { InGameSkillSection } from '@/lib/ingame-schemas';
import { SkillStars } from './PlayerModal';

const FONT = 'Barlow Condensed, sans-serif';

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random()}`;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div
      className="text-sm font-bold uppercase tracking-wide px-5 py-2"
      style={{ fontFamily: FONT, color: '#1a1a1a', background: '#efefef' }}
    >
      {title}
    </div>
  );
}

function WkEventList({ events, onChange }: { events: WkEvent[]; onChange: (events: WkEvent[]) => void }) {
  const addEntry = () => onChange([...events, { id: newId(), type: 'Bye', runs: 0 }]);
  const update = (id: string, patch: Partial<WkEvent>) =>
    onChange(events.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const remove = (id: string) => onChange(events.filter((e) => e.id !== id));

  return (
    <div className="px-5 py-3">
      {events.map((ev) => (
        <div key={ev.id} className="flex items-center gap-2 mb-2">
          <select
            value={ev.type}
            onChange={(e) => update(ev.id, { type: e.target.value as WkEventType })}
            className="text-xs border rounded px-1.5 py-1"
            style={{ borderColor: '#e5e5e5', fontFamily: FONT }}
          >
            <option value="Bye">Bye Conceded</option>
            <option value="MissedCatch">Missed Catch</option>
          </select>
          {ev.type === 'Bye' ? (
            <input
              type="number"
              value={ev.runs ?? 0}
              onChange={(e) => update(ev.id, { runs: Number(e.target.value) })}
              placeholder="Runs"
              className="w-16 text-xs border rounded px-1.5 py-1"
              style={{ borderColor: '#e5e5e5' }}
            />
          ) : (
            <input
              type="number"
              value={ev.count ?? 1}
              onChange={(e) => update(ev.id, { count: Number(e.target.value) })}
              placeholder="Count"
              className="w-16 text-xs border rounded px-1.5 py-1"
              style={{ borderColor: '#e5e5e5' }}
            />
          )}
          <input
            type="text"
            value={ev.note || ''}
            onChange={(e) => update(ev.id, { note: e.target.value })}
            placeholder="Note (optional)"
            className="flex-1 text-xs border rounded px-2 py-1"
            style={{ borderColor: '#e5e5e5' }}
          />
          <button onClick={() => remove(ev.id)} className="text-sm px-1.5" style={{ color: '#c0392b' }}>✕</button>
        </div>
      ))}
      <button
        onClick={addEntry}
        className="text-xs font-bold uppercase px-3 py-1.5 rounded"
        style={{ fontFamily: FONT, background: '#e8e0d0', color: '#4a4a4a' }}
      >
        + Add Entry
      </button>
    </div>
  );
}

function FieldingEntryList({ entries, onChange }: { entries: FieldingEntry[]; onChange: (entries: FieldingEntry[]) => void }) {
  const addEntry = () => onChange([...entries, { id: newId(), type: 'Saved', runs: 0 }]);
  const update = (id: string, patch: Partial<FieldingEntry>) =>
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const remove = (id: string) => onChange(entries.filter((e) => e.id !== id));

  return (
    <div className="px-5 py-3">
      {entries.map((en) => (
        <div key={en.id} className="flex items-center gap-2 mb-2">
          <select
            value={en.type}
            onChange={(e) => update(en.id, { type: e.target.value as FieldingEntryType })}
            className="text-xs border rounded px-1.5 py-1"
            style={{ borderColor: '#e5e5e5', fontFamily: FONT }}
          >
            <option value="Saved">Runs Saved</option>
            <option value="Conceded">Runs Conceded</option>
            <option value="CatchDropped">Catch Dropped</option>
          </select>
          {en.type !== 'CatchDropped' && (
            <input
              type="number"
              value={en.runs}
              onChange={(e) => update(en.id, { runs: Number(e.target.value) })}
              placeholder="Runs"
              className="w-16 text-xs border rounded px-1.5 py-1"
              style={{ borderColor: '#e5e5e5' }}
            />
          )}
          <input
            type="text"
            value={en.note || ''}
            onChange={(e) => update(en.id, { note: e.target.value })}
            placeholder="Note (optional)"
            className="flex-1 text-xs border rounded px-2 py-1"
            style={{ borderColor: '#e5e5e5' }}
          />
          <button onClick={() => remove(en.id)} className="text-sm px-1.5" style={{ color: '#c0392b' }}>✕</button>
        </div>
      ))}
      <button
        onClick={addEntry}
        className="text-xs font-bold uppercase px-3 py-1.5 rounded"
        style={{ fontFamily: FONT, background: '#e8e0d0', color: '#4a4a4a' }}
      >
        + Add Entry
      </button>
    </div>
  );
}

function CatchDroppedEntryList({ entries, onChange }: { entries: CatchDroppedEntry[]; onChange: (entries: CatchDroppedEntry[]) => void }) {
  const addEntry = () => onChange([...entries, { id: newId(), count: 1 }]);
  const update = (id: string, patch: Partial<CatchDroppedEntry>) =>
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const remove = (id: string) => onChange(entries.filter((e) => e.id !== id));

  return (
    <div className="px-5 py-3">
      {entries.map((en) => (
        <div key={en.id} className="flex items-center gap-2 mb-2">
          <input
            type="number"
            min={1}
            value={en.count}
            onChange={(e) => update(en.id, { count: Number(e.target.value) })}
            placeholder="Count"
            className="w-16 text-xs border rounded px-1.5 py-1"
            style={{ borderColor: '#e5e5e5' }}
          />
          <input
            type="text"
            value={en.note || ''}
            onChange={(e) => update(en.id, { note: e.target.value })}
            placeholder="Note (optional)"
            className="flex-1 text-xs border rounded px-2 py-1"
            style={{ borderColor: '#e5e5e5' }}
          />
          <button onClick={() => remove(en.id)} className="text-sm px-1.5" style={{ color: '#c0392b' }}>✕</button>
        </div>
      ))}
      <button
        onClick={addEntry}
        className="text-xs font-bold uppercase px-3 py-1.5 rounded"
        style={{ fontFamily: FONT, background: '#e8e0d0', color: '#4a4a4a' }}
      >
        + Add Entry
      </button>
    </div>
  );
}

function NotesBox({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (v: string) => void }) {
  return (
    <div className="px-5 py-2">
      <textarea
        className="w-full border rounded text-xs px-2.5 py-1.5 resize-none focus:outline-none focus:border-[#1a2e1a] transition-colors"
        style={{ borderColor: '#e5e5e5', background: '#fafafa' }}
        rows={2}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SkillRow({ name, desc, value, onChange }: { name: string; desc?: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-2 border-b last:border-b-0" style={{ borderColor: '#f0f0f0' }}>
      <span className="text-sm font-bold uppercase tracking-wide" style={{ fontFamily: FONT, color: '#1a1a1a' }} title={desc}>
        {name}
      </span>
      <SkillStars skillName={name} value={value} onChange={onChange} />
    </div>
  );
}

function SkillSectionGroup({
  section,
  values,
  onChange,
}: {
  section: InGameSkillSection;
  values: Record<string, number>;
  onChange: (name: string, value: number) => void;
}) {
  return (
    <div>
      <div className="px-5 py-1.5 text-xs font-bold uppercase tracking-widest" style={{ fontFamily: FONT, color: '#fff', background: '#2e4030' }}>
        {section.letter}. {section.name}
      </div>
      {section.skills.map((sk) => (
        <SkillRow
          key={sk.name}
          name={sk.name}
          desc={sk.desc}
          value={values[sk.name] || 0}
          onChange={(v) => onChange(sk.name, v)}
        />
      ))}
    </div>
  );
}

interface InGameRatingModalProps {
  player: ScoutPlayer;
  gameNumber: number;
  teamIndex: number;
  onClose: () => void;
  onSave: (payload: InGameRatingPayload) => void;
  saving: boolean;
}

export function InGameRatingModal({ player, gameNumber, teamIndex, onClose, onSave, saving }: InGameRatingModalProps) {
  const [rating, setRating] = useState<InGameRating>(() => ({
    ...emptyInGameRating(),
    battedThisGame: player.schema === 'Batsman',
    bowledFast: player.schema === 'Fast Bowler',
    bowledSpin: player.schema === 'Spin Bowler',
  }));
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const setSkill = (group: 'battingSkills' | 'fastBowlingSkills' | 'spinBowlingSkills', name: string, value: number) => {
    setRating((prev) => ({ ...prev, [group]: { ...prev[group], [name]: value } }));
  };

  const handleSave = () => {
    onSave({ playerRowIndex: player.rowIndex, teamIndex, gameNumber, rating });
  };

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
              {player.category} · Game {gameNumber}
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

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <SectionHeader title="Batting" />
          <div className="px-5 py-2.5">
            <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide" style={{ fontFamily: FONT, color: '#1a1a1a' }}>
              <input
                type="checkbox"
                checked={rating.battedThisGame}
                onChange={(e) => setRating((prev) => ({ ...prev, battedThisGame: e.target.checked }))}
              />
              Batted this game
            </label>
          </div>
          {rating.battedThisGame && (
            <>
              {BATTING_SKILL_SECTIONS.map((sec) => (
                <SkillSectionGroup
                  key={sec.letter}
                  section={sec}
                  values={rating.battingSkills}
                  onChange={(name, v) => setSkill('battingSkills', name, v)}
                />
              ))}
              <div className="px-5 py-1.5 text-xs font-bold uppercase tracking-wide" style={{ fontFamily: FONT, color: '#4a4a4a' }}>
                Catches Dropped (off this player&rsquo;s batting)
              </div>
              <CatchDroppedEntryList
                entries={rating.battingCatchesDropped}
                onChange={(battingCatchesDropped) => setRating((prev) => ({ ...prev, battingCatchesDropped }))}
              />
              <NotesBox
                value={rating.battingNotes}
                placeholder="General comments on batting…"
                onChange={(battingNotes) => setRating((prev) => ({ ...prev, battingNotes }))}
              />
            </>
          )}

          <SectionHeader title="Fast Bowling" />
          <div className="px-5 py-2.5">
            <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide" style={{ fontFamily: FONT, color: '#1a1a1a' }}>
              <input
                type="checkbox"
                checked={rating.bowledFast}
                onChange={(e) => setRating((prev) => ({ ...prev, bowledFast: e.target.checked }))}
              />
              Bowled fast bowling this game
            </label>
          </div>
          {rating.bowledFast && (
            <>
              {FAST_BOWLING_SKILL_SECTIONS.map((sec) => (
                <SkillSectionGroup
                  key={sec.letter}
                  section={sec}
                  values={rating.fastBowlingSkills}
                  onChange={(name, v) => setSkill('fastBowlingSkills', name, v)}
                />
              ))}
              <div className="px-5 py-1.5 text-xs font-bold uppercase tracking-wide" style={{ fontFamily: FONT, color: '#4a4a4a' }}>
                Catches Dropped (off this player&rsquo;s bowling)
              </div>
              <CatchDroppedEntryList
                entries={rating.fastBowlingCatchesDropped}
                onChange={(fastBowlingCatchesDropped) => setRating((prev) => ({ ...prev, fastBowlingCatchesDropped }))}
              />
              <NotesBox
                value={rating.fastBowlingNotes}
                placeholder="General comments on fast bowling…"
                onChange={(fastBowlingNotes) => setRating((prev) => ({ ...prev, fastBowlingNotes }))}
              />
            </>
          )}

          <SectionHeader title="Spin Bowling" />
          <div className="px-5 py-2.5">
            <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide" style={{ fontFamily: FONT, color: '#1a1a1a' }}>
              <input
                type="checkbox"
                checked={rating.bowledSpin}
                onChange={(e) => setRating((prev) => ({ ...prev, bowledSpin: e.target.checked }))}
              />
              Bowled spin bowling this game
            </label>
          </div>
          {rating.bowledSpin && (
            <>
              {SPIN_BOWLING_SKILL_SECTIONS.map((sec) => (
                <SkillSectionGroup
                  key={sec.letter}
                  section={sec}
                  values={rating.spinBowlingSkills}
                  onChange={(name, v) => setSkill('spinBowlingSkills', name, v)}
                />
              ))}
              <div className="px-5 py-1.5 text-xs font-bold uppercase tracking-wide" style={{ fontFamily: FONT, color: '#4a4a4a' }}>
                Catches Dropped (off this player&rsquo;s bowling)
              </div>
              <CatchDroppedEntryList
                entries={rating.spinBowlingCatchesDropped}
                onChange={(spinBowlingCatchesDropped) => setRating((prev) => ({ ...prev, spinBowlingCatchesDropped }))}
              />
              <NotesBox
                value={rating.spinBowlingNotes}
                placeholder="General comments on spin bowling…"
                onChange={(spinBowlingNotes) => setRating((prev) => ({ ...prev, spinBowlingNotes }))}
              />
            </>
          )}

          <SectionHeader title="Wicket Keeping" />
          <div className="px-5 py-2.5">
            <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide" style={{ fontFamily: FONT, color: '#1a1a1a' }}>
              <input
                type="checkbox"
                checked={rating.keptWicket}
                onChange={(e) => setRating((prev) => ({ ...prev, keptWicket: e.target.checked }))}
              />
              Kept wicket this game
            </label>
          </div>
          {rating.keptWicket && (
            <>
              <NotesBox
                value={rating.wkNotes}
                placeholder="Notes on wicketkeeping performance…"
                onChange={(wkNotes) => setRating((prev) => ({ ...prev, wkNotes }))}
              />
              <WkEventList
                events={rating.wkEvents}
                onChange={(wkEvents) => setRating((prev) => ({ ...prev, wkEvents }))}
              />
            </>
          )}

          <SectionHeader title="Fielding" />
          <NotesBox
            value={rating.fieldingNotes}
            placeholder="General comments on fielding…"
            onChange={(fieldingNotes) => setRating((prev) => ({ ...prev, fieldingNotes }))}
          />
          <FieldingEntryList
            entries={rating.fieldingEntries}
            onChange={(fieldingEntries) => setRating((prev) => ({ ...prev, fieldingEntries }))}
          />

          <SectionHeader title="Overall" />
          <NotesBox
            value={rating.overallNotes}
            placeholder="Overall comments — temperament, teamwork, attitude, awareness, pre-game warmup, post-game cleanup, etc…"
            onChange={(overallNotes) => setRating((prev) => ({ ...prev, overallNotes }))}
          />
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-end gap-2.5 px-5 py-3.5 border-t" style={{ background: '#fafafa', borderColor: '#eee' }}>
          <button
            className="font-bold uppercase tracking-wider text-sm px-5 py-2 rounded-md transition-all hover:opacity-80 hover:-translate-y-px cursor-pointer"
            style={{ fontFamily: FONT, background: '#e8e0d0', color: '#4a4a4a', border: 'none' }}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="font-bold uppercase tracking-wider text-sm px-5 py-2 rounded-md transition-all hover:opacity-85 hover:-translate-y-px cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ fontFamily: FONT, background: '#1a2e1a', color: '#f5f0e8', border: 'none' }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Rating'}
          </button>
        </div>
      </div>
    </div>
  );
}
