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
  status: 'draft' | 'submitted';
  shared: boolean;
  locked?: boolean;
  comments?: string;
  teams: PackageTeam[];
  savedAt: string;
}
