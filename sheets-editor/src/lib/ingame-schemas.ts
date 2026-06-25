import type { InGameRating, CatchDroppedEntry } from '@/types/scout';

export interface InGameSkillDef {
  name: string;
}

export const BATTING_SKILLS: InGameSkillDef[] = [
  { name: 'Shot Selection' },
  { name: 'Footwork' },
  { name: 'Running Between Wickets' },
  { name: 'Temperament Under Pressure' },
  { name: 'Game Awareness' },
];

export const FAST_BOWLING_SKILLS: InGameSkillDef[] = [
  { name: 'Line & Length' },
  { name: 'Pace' },
  { name: 'Variations' },
  { name: 'Death Overs Execution' },
];

export const SPIN_BOWLING_SKILLS: InGameSkillDef[] = [
  { name: 'Control / Accuracy' },
  { name: 'Turn / Drift' },
  { name: 'Variations' },
  { name: 'Wicket-Taking Threat' },
];

export const GAME_NUMBERS = [1, 2, 3, 4, 5, 6] as const;

export function emptyInGameRating(): InGameRating {
  return {
    battingSkills: {},
    battingCatchesDropped: [],
    battingNotes: '',
    bowledFast: false,
    fastBowlingSkills: {},
    fastBowlingCatchesDropped: [],
    fastBowlingNotes: '',
    bowledSpin: false,
    spinBowlingSkills: {},
    spinBowlingCatchesDropped: [],
    spinBowlingNotes: '',
    keptWicket: false,
    wkNotes: '',
    wkEvents: [],
    fieldingNotes: '',
    fieldingEntries: [],
    overallNotes: '',
  };
}

function asEntryArray(v: unknown): CatchDroppedEntry[] {
  return Array.isArray(v) ? v : [];
}

export function parseInGameRating(json: string): InGameRating {
  try {
    if (!json || json.trim() === '') return emptyInGameRating();
    const parsed = JSON.parse(json);
    return {
      battingSkills:
        typeof parsed.battingSkills === 'object' && parsed.battingSkills !== null
          ? parsed.battingSkills
          : {},
      battingCatchesDropped: asEntryArray(parsed.battingCatchesDropped),
      battingNotes: typeof parsed.battingNotes === 'string' ? parsed.battingNotes : '',
      bowledFast: !!parsed.bowledFast,
      fastBowlingSkills:
        typeof parsed.fastBowlingSkills === 'object' && parsed.fastBowlingSkills !== null
          ? parsed.fastBowlingSkills
          : {},
      fastBowlingCatchesDropped: asEntryArray(parsed.fastBowlingCatchesDropped),
      fastBowlingNotes: typeof parsed.fastBowlingNotes === 'string' ? parsed.fastBowlingNotes : '',
      bowledSpin: !!parsed.bowledSpin,
      spinBowlingSkills:
        typeof parsed.spinBowlingSkills === 'object' && parsed.spinBowlingSkills !== null
          ? parsed.spinBowlingSkills
          : {},
      spinBowlingCatchesDropped: asEntryArray(parsed.spinBowlingCatchesDropped),
      spinBowlingNotes: typeof parsed.spinBowlingNotes === 'string' ? parsed.spinBowlingNotes : '',
      keptWicket: !!parsed.keptWicket,
      wkNotes: typeof parsed.wkNotes === 'string' ? parsed.wkNotes : '',
      wkEvents: Array.isArray(parsed.wkEvents) ? parsed.wkEvents : [],
      fieldingNotes: typeof parsed.fieldingNotes === 'string' ? parsed.fieldingNotes : '',
      fieldingEntries: Array.isArray(parsed.fieldingEntries) ? parsed.fieldingEntries : [],
      overallNotes: typeof parsed.overallNotes === 'string' ? parsed.overallNotes : '',
    };
  } catch {
    return emptyInGameRating();
  }
}
