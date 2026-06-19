import type { PlayerEvaluation, SchemaType } from '@/types/scout';

export interface SkillDef {
  name: string;
  desc: string;
  weight: number;
}

export interface SectionDef {
  letter: string;
  name: string;
  skills: SkillDef[];
}

export interface SchemaDef {
  maxScore: number;
  sections: SectionDef[];
}

export const SCHEMAS: Record<SchemaType, SchemaDef> = {
  Batsman: {
    maxScore: 340,
    sections: [
      {
        letter: 'A', name: 'Batting Technique', skills: [
          { name: 'Stance & Setup', desc: 'Balanced stance, head position, backlift', weight: 2 },
          { name: 'Footwork', desc: 'Decisive forward/back movement to pitch of ball', weight: 3 },
          { name: 'Shot Selection', desc: 'Choosing right shot for the delivery', weight: 3 },
          { name: 'Defensive Technique', desc: 'Solid defense, soft hands, leaving ability', weight: 3 },
          { name: 'Playing Spin', desc: 'Ability to read and play spin bowling effectively', weight: 2 },
          { name: 'Playing Pace', desc: 'Technique against fast/short-pitched bowling', weight: 2 },
        ],
      },
      {
        letter: 'B', name: 'Scoring Ability', skills: [
          { name: 'Stroke Range', desc: 'Variety of shots (drives, cuts, pulls, sweeps)', weight: 3 },
          { name: 'Power Hitting', desc: 'Ability to clear the boundary consistently', weight: 2 },
          { name: 'Running Between Wickets', desc: 'Speed, calling, turning, ground cover', weight: 2 },
          { name: 'Strike Rotation', desc: 'Ability to rotate strike and find gaps', weight: 3 },
          { name: 'Boundary %', desc: 'Percentage of runs scored in boundaries', weight: 2 },
        ],
      },
      {
        letter: 'C', name: 'Temperament & Mental', skills: [
          { name: 'Concentration', desc: 'Ability to bat for long periods without lapse', weight: 3 },
          { name: 'Pressure Handling', desc: 'Performance in crunch situations/chases', weight: 3 },
          { name: 'Consistency', desc: 'Regular scores vs. occasional big innings', weight: 3 },
          { name: 'Adaptability', desc: 'Adjusting game plan to match situation', weight: 2 },
          { name: 'Partnership Building', desc: 'Ability to build partnerships with different batters', weight: 2 },
        ],
      },
      {
        letter: 'D', name: 'Match Impact', skills: [
          { name: 'Anchoring Innings', desc: 'Ability to hold one end and bat through', weight: 3 },
          { name: 'Acceleration', desc: 'Ability to increase scoring rate when needed', weight: 3 },
          { name: 'Chasing Ability', desc: 'Performance in run chases', weight: 2 },
          { name: 'Match-Winning Knocks', desc: 'Frequency of decisive innings', weight: 3 },
        ],
      },
      {
        letter: 'E', name: 'Fielding Contribution', skills: [
          { name: 'Catching', desc: 'Catch success rate in close/outfield positions', weight: 2 },
          { name: 'Ground Fielding', desc: 'Stopping, diving, throwing accuracy', weight: 2 },
          { name: 'Fitness & Agility', desc: 'Overall athleticism and endurance', weight: 2 },
        ],
      },
      {
        letter: 'F', name: 'Match Statistics', skills: [
          { name: 'Batting Average', desc: 'Runs per dismissal (higher is better)', weight: 3 },
          { name: 'Batting Strike Rate', desc: 'Runs per 100 balls (context-dependent)', weight: 3 },
          { name: '50s and 100s', desc: 'Frequency of significant scores', weight: 3 },
          { name: 'Runs in Last 10 Matches', desc: 'Recent form indicator', weight: 2 },
        ],
      },
    ],
  },

  'Fast Bowler': {
    maxScore: 280,
    sections: [
      {
        letter: 'A', name: 'Pace & Speed', skills: [
          { name: 'Bowling Speed', desc: 'Consistent pace (140+ elite, 130–139 good, 120–129 avg)', weight: 3 },
          { name: 'Speed Variation', desc: 'Ability to change pace effectively (slower balls, cutters)', weight: 2 },
          { name: 'Effort Ball', desc: 'Ability to bowl a quick delivery when needed', weight: 2 },
        ],
      },
      {
        letter: 'B', name: 'Accuracy & Control', skills: [
          { name: 'Line & Length', desc: 'Consistently hitting good length on/outside off stump', weight: 3 },
          { name: 'Yorker Execution', desc: 'Ability to bowl yorkers at will, especially at death', weight: 3 },
          { name: 'Bouncer Control', desc: 'Effective short-pitched bowling, targeting body/helmet', weight: 2 },
          { name: 'Wide/No-Ball Rate', desc: 'Minimal extras conceded per spell', weight: 2 },
        ],
      },
      {
        letter: 'C', name: 'Swing & Seam Movement', skills: [
          { name: 'Swing (New Ball)', desc: 'Ability to swing the new ball (in/out)', weight: 3 },
          { name: 'Reverse Swing', desc: 'Ability to reverse swing the old ball', weight: 2 },
          { name: 'Seam Movement', desc: 'Ability to get seam movement off the pitch', weight: 3 },
          { name: 'Wrist Position', desc: 'Correct wrist position for desired movement', weight: 2 },
        ],
      },
      {
        letter: 'D', name: 'Bowling Action & Fitness', skills: [
          { name: 'Bowling Action', desc: 'Smooth, repeatable, legal action', weight: 2 },
          { name: 'Run-up Consistency', desc: 'Consistent run-up and delivery stride', weight: 2 },
          { name: 'Stamina & Fitness', desc: 'Ability to bowl long spells without drop in pace', weight: 3 },
          { name: 'Injury Resilience', desc: 'History of staying fit, workload management', weight: 2 },
        ],
      },
      {
        letter: 'E', name: 'Match Awareness & Tactical', skills: [
          { name: 'Powerplay Bowling', desc: 'Effectiveness with new ball in first 6 overs', weight: 3 },
          { name: 'Death Bowling', desc: 'Performance in last 4–5 overs under pressure', weight: 3 },
          { name: 'Pressure Handling', desc: 'Composure in tight match situations', weight: 2 },
          { name: 'Field Setting Input', desc: 'Understanding of field placements for plans', weight: 1 },
        ],
      },
      {
        letter: 'F', name: 'Match Statistics', skills: [
          { name: 'Bowling Average', desc: 'Runs per wicket (lower is better)', weight: 3 },
          { name: 'Economy Rate', desc: 'Runs per over (lower is better)', weight: 3 },
          { name: 'Bowling Strike Rate', desc: 'Balls per wicket (lower is better)', weight: 3 },
          { name: '5-Wicket Hauls', desc: 'Frequency of match-winning spells', weight: 2 },
        ],
      },
    ],
  },

  'Spin Bowler': {
    maxScore: 290,
    sections: [
      {
        letter: 'A', name: 'Spin & Turn', skills: [
          { name: 'Degree of Turn', desc: 'Amount of turn extracted from the pitch', weight: 3 },
          { name: 'Flight & Loop', desc: 'Ability to toss the ball up with deceptive flight', weight: 3 },
          { name: 'Drift', desc: 'Ability to drift the ball in the air before turning', weight: 2 },
          { name: 'Bounce Extraction', desc: 'Getting extra bounce from the surface', weight: 2 },
        ],
      },
      {
        letter: 'B', name: 'Variations', skills: [
          { name: 'Stock Delivery', desc: 'Consistency and quality of main delivery', weight: 3 },
          { name: 'Arm Ball / Slider', desc: 'Effective straight delivery that skids on', weight: 2 },
          { name: 'Googly / Doosra', desc: 'Quality of wrong-un or opposite spin delivery', weight: 3 },
          { name: 'Top Spinner', desc: 'Effective top-spin delivery for extra bounce', weight: 2 },
          { name: 'Pace Variation', desc: 'Ability to change speed effectively', weight: 2 },
        ],
      },
      {
        letter: 'C', name: 'Accuracy & Control', skills: [
          { name: 'Line & Length', desc: 'Consistent hitting of ideal length for spin', weight: 3 },
          { name: 'Control in Powerplay', desc: 'Economy and wicket-taking in PP overs', weight: 2 },
          { name: 'Middle Overs Control', desc: 'Ability to strangle run-scoring', weight: 3 },
          { name: 'Death Overs Spin', desc: 'Effectiveness bowling spin at the death', weight: 2 },
        ],
      },
      {
        letter: 'D', name: 'Tactical Intelligence', skills: [
          { name: 'Reading Batsmen', desc: 'Ability to set up and outthink batsmen', weight: 3 },
          { name: 'Field Placement', desc: 'Understanding of optimal fields for plans', weight: 2 },
          { name: 'Pressure Bowling', desc: 'Performance in high-pressure situations', weight: 3 },
          { name: 'Adaptability', desc: 'Adjusting to different pitch conditions', weight: 2 },
        ],
      },
      {
        letter: 'E', name: 'Action & Fitness', skills: [
          { name: 'Bowling Action', desc: 'Legal, repeatable action with good rotation', weight: 2 },
          { name: 'Fitness Level', desc: 'Ability to bowl long spells with consistency', weight: 2 },
          { name: 'Fielding off Own Bowling', desc: 'Agility and reflexes in follow-through', weight: 1 },
        ],
      },
      {
        letter: 'F', name: 'Match Statistics', skills: [
          { name: 'Bowling Average', desc: 'Runs per wicket (lower is better)', weight: 3 },
          { name: 'Economy Rate', desc: 'Runs per over (lower is better)', weight: 3 },
          { name: 'Bowling Strike Rate', desc: 'Balls per wicket (lower is better)', weight: 3 },
          { name: 'Wickets in Last 10 Matches', desc: 'Recent form indicator', weight: 2 },
        ],
      },
    ],
  },
};

export function calcScore(
  evaluation: PlayerEvaluation,
  schema: SchemaDef
): { weighted: number; pct: number } {
  let weighted = 0;
  schema.sections.forEach((sec) => {
    sec.skills.forEach((sk) => {
      weighted += (evaluation.skills[sk.name] || 0) * sk.weight;
    });
  });
  return { weighted, pct: Math.round((weighted / schema.maxScore) * 100) };
}

export function getRating(pct: number): { label: string; cls: string } {
  if (pct >= 90) return { label: 'Must Select', cls: 'must' };
  if (pct >= 75) return { label: 'Highly Recommended', cls: 'highly' };
  if (pct >= 60) return { label: 'Recommended', cls: 'rec' };
  if (pct >= 45) return { label: 'Consider', cls: 'cons' };
  return { label: 'Not Recommended', cls: 'no' };
}

export function playerInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export const FITNESS_FIELDS = [
  'Yo-Yo',
  'Jump Try 1',
  'Jump Try 2',
  'Jump Try 3',
  'Straight Plank',
  'Right Side Plank',
  'Left Side Plank',
] as const;

export function parseEvaluation(json: string): PlayerEvaluation {
  try {
    if (!json || json.trim() === '') return { skills: {}, notes: {}, fitness: {} };
    const parsed = JSON.parse(json);
    return {
      skills:
        typeof parsed.skills === 'object' && parsed.skills !== null
          ? parsed.skills
          : {},
      notes:
        typeof parsed.notes === 'object' && parsed.notes !== null
          ? parsed.notes
          : {},
      fitness:
        typeof parsed.fitness === 'object' && parsed.fitness !== null
          ? parsed.fitness
          : {},
    };
  } catch {
    return { skills: {}, notes: {}, fitness: {} };
  }
}
