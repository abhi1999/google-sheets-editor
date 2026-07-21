import type { InGameRating, CatchDroppedEntry } from '@/types/scout';
import { SCHEMAS } from '@/lib/scout-schemas';

export interface InGameSkillDef {
  name: string;
  desc?: string;
}

export interface InGameSkillSection {
  letter: string;
  name: string;
  skills: InGameSkillDef[];
}

// In-game skill lists are derived from the tryout rubric (SCHEMAS) so the two stay
// in sync. We exclude sections that don't make sense for a single-game rating:
// "Match Statistics" (season/career aggregates, not a per-game observation) for every
// schema, and Batsman's "Fielding Contribution" (already covered by the dedicated
// in-game Fielding section).
function sectionsFor(schema: keyof typeof SCHEMAS, excludeLetters: string[]): InGameSkillSection[] {
  return SCHEMAS[schema].sections
    .filter((s) => !excludeLetters.includes(s.letter))
    .map((s) => ({
      letter: s.letter,
      name: s.name,
      skills: s.skills.map((sk) => ({ name: sk.name, desc: sk.desc })),
    }));
}

export const BATTING_SKILL_SECTIONS: InGameSkillSection[] = sectionsFor('Batsman', ['E', 'F']);
export const FAST_BOWLING_SKILL_SECTIONS: InGameSkillSection[] = sectionsFor('Fast Bowler', ['F']);
export const SPIN_BOWLING_SKILL_SECTIONS: InGameSkillSection[] = sectionsFor('Spin Bowler', ['F']);

export const WK_SKILL_SECTIONS: InGameSkillSection[] = [
  {
    letter: 'A',
    name: 'Wicket Keeping Skills',
    skills: [
      { name: 'Footwork & Movement',         desc: 'Quick, balanced, and efficient movement behind the stumps.' },
      { name: 'Catching Technique',           desc: 'Safe hands, soft grip, and consistent catching ability.' },
      { name: 'Keeping Against Spin Bowling', desc: 'Positioning, anticipation, and clean glove work against spin.' },
      { name: 'Keeping Against Pace Bowling', desc: 'Reflexes, technique, and handling pace with confidence.' },
      { name: 'Ball Collection & Gathering',  desc: 'Clean collection, quick pickups, and effective ball control for run-out and stumping opportunities.' },
    ],
  },
];

export const FIELDING_SKILL_SECTIONS: InGameSkillSection[] = [
  {
    letter: 'A',
    name: 'Fielding Skills',
    skills: [
      { name: 'Groundfielding',         desc: 'Stopping, retrieving, and throwing the ball cleanly from the outfield and infield.' },
      { name: 'Awareness in the Field', desc: 'Positioning, backing up, and reading the game situation.' },
      { name: 'Catching Ability',       desc: 'Taking catches reliably at any position.' },
      { name: 'Utility',                desc: 'Ability to field effectively in any position across the ground.' },
    ],
  },
];

// Flat lists for places that just need a single defs array (e.g. score-presence checks).
export const BATTING_SKILLS: InGameSkillDef[] = BATTING_SKILL_SECTIONS.flatMap((s) => s.skills);
export const FAST_BOWLING_SKILLS: InGameSkillDef[] = FAST_BOWLING_SKILL_SECTIONS.flatMap((s) => s.skills);
export const SPIN_BOWLING_SKILLS: InGameSkillDef[] = SPIN_BOWLING_SKILL_SECTIONS.flatMap((s) => s.skills);
export const WK_SKILLS: InGameSkillDef[] = WK_SKILL_SECTIONS.flatMap((s) => s.skills);
export const FIELDING_SKILLS: InGameSkillDef[] = FIELDING_SKILL_SECTIONS.flatMap((s) => s.skills);

export const GAME_NUMBERS = [1, 2, 3, 4, 5, 6] as const;

export function emptyInGameRating(): InGameRating {
  return {
    battedThisGame: true,
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
    wkSkills: {},
    wkNotes: '',
    wkEvents: [],
    fieldingSkills: {},
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
      battedThisGame: typeof parsed.battedThisGame === 'boolean' ? parsed.battedThisGame : true,
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
      wkSkills:
        typeof parsed.wkSkills === 'object' && parsed.wkSkills !== null ? parsed.wkSkills : {},
      wkNotes: typeof parsed.wkNotes === 'string' ? parsed.wkNotes : '',
      wkEvents: Array.isArray(parsed.wkEvents) ? parsed.wkEvents : [],
      fieldingSkills:
        typeof parsed.fieldingSkills === 'object' && parsed.fieldingSkills !== null ? parsed.fieldingSkills : {},
      fieldingNotes: typeof parsed.fieldingNotes === 'string' ? parsed.fieldingNotes : '',
      fieldingEntries: Array.isArray(parsed.fieldingEntries) ? parsed.fieldingEntries : [],
      overallNotes: typeof parsed.overallNotes === 'string' ? parsed.overallNotes : '',
    };
  } catch {
    return emptyInGameRating();
  }
}
