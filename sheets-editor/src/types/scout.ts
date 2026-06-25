export type SchemaType = 'Batsman' | 'Fast Bowler' | 'Spin Bowler';

export interface PlayerEvaluation {
  skills: Record<string, number>;
  notes: Record<string, string>;
  fitness: Record<string, string>;
}

export interface CoachEval {
  coachEmail: string;
  coachName: string;
  evaluation: PlayerEvaluation;
  score: number;
  pct: number;
  rating: string;
  remarks: string;
  savedAt: string;
}

export interface ScoutPlayer {
  rowIndex: number;
  batch: string;
  name: string;
  div: string;
  category: string;
  schema: SchemaType;
  score: number;
  pct: number;
  rating: string;
  remarks: string;
  evaluation: PlayerEvaluation;       // pre-filled from myEval for the form
  extraInfo: Record<string, string>;
  coachEvals: CoachEval[];            // all coach evals for this player
  myEval: CoachEval | null;           // current user's own eval
  aggregatePct: number;               // average pct across all coaches
}

export interface ScoutUpdatePayload {
  rowIndex: number;
  evaluation: PlayerEvaluation;
  score: number;
  pct: number;
  rating: string;
  remarks: string;
}

export interface CoachEvalPayload {
  playerRowIndex: number;
  evaluation: PlayerEvaluation;
  score: number;
  pct: number;
  rating: string;
  remarks: string;
}

export interface ScoutApiResponse {
  players: ScoutPlayer[];
  isEditor: boolean;
  isAdmin: boolean;
}

export interface TeamSlot {
  slot: number;
  playerRowIndex: number | null;
  playerName: string;
}

export interface PackageTeam {
  teamIndex: number;
  teamName: string;
  slots: TeamSlot[];
  captain?: number | null;
  vc?: number | null;
  wks?: number[];
}

export interface TeamPackage {
  packageId: string;
  coachEmail: string;
  coachName: string;
  packageName: string;
  status: 'draft' | 'submitted' | 'approved';
  shared: boolean;
  locked?: boolean;
  comments?: string;
  teams: PackageTeam[];
  savedAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

export type FieldingEntryType = 'Saved' | 'Conceded' | 'CatchDropped';

export interface FieldingEntry {
  id: string;
  type: FieldingEntryType;
  runs: number;
  note?: string;
}

export type WkEventType = 'Bye' | 'MissedCatch';

export interface WkEvent {
  id: string;
  type: WkEventType;
  runs?: number;
  count?: number;
  note?: string;
}

// A chance the player gave (while batting) or created (while bowling) that the
// fielding side failed to convert — distinct from FieldingEntry's 'CatchDropped',
// which records a catch THIS player (as a fielder) personally dropped.
export interface CatchDroppedEntry {
  id: string;
  count: number;
  note?: string;
}

export interface InGameRating {
  battedThisGame: boolean;
  battingSkills: Record<string, number>;
  battingCatchesDropped: CatchDroppedEntry[];
  battingNotes: string;
  bowledFast: boolean;
  fastBowlingSkills: Record<string, number>;
  fastBowlingCatchesDropped: CatchDroppedEntry[];
  fastBowlingNotes: string;
  bowledSpin: boolean;
  spinBowlingSkills: Record<string, number>;
  spinBowlingCatchesDropped: CatchDroppedEntry[];
  spinBowlingNotes: string;
  keptWicket: boolean;
  wkNotes: string;
  wkEvents: WkEvent[];
  fieldingNotes: string;
  fieldingEntries: FieldingEntry[];
  overallNotes: string;
}

export interface InGameRatingRecord {
  id: string;
  coachEmail: string;
  coachName: string;
  playerRowIndex: number;
  teamIndex: number; // 1-6, matches PackageTeam.teamIndex
  gameNumber: number; // 1-6
  rating: InGameRating;
  savedAt: string;
}

export interface InGameRatingPayload {
  playerRowIndex: number;
  teamIndex: number;
  gameNumber: number;
  rating: InGameRating;
}

export interface OpportunityEntry {
  playerRowIndex: number;
  battingOrder: number | null; // batting position, null = did not bat
  bowlingOrder: number | null; // bowling sequence position, null = did not bowl
  oversBowled: number; // whole overs, 0 if did not bowl
}

export interface OpportunityRecord {
  teamIndex: number; // 1-6, matches PackageTeam.teamIndex
  gameNumber: number; // 1-6
  coachName: string; // coach who ran this team for this game — free text
  entries: OpportunityEntry[];
  updatedBy: string;
  updatedByName: string;
  updatedAt: string;
}

export interface OpportunitySheetPayload {
  teamIndex: number;
  gameNumber: number;
  coachName: string;
  entries: OpportunityEntry[];
}
