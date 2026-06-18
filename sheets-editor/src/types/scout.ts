export type SchemaType = 'Batsman' | 'Fast Bowler' | 'Spin Bowler';

export interface PlayerEvaluation {
  skills: Record<string, number>;
  notes: Record<string, string>;
  fitness: Record<string, string>;
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
  evaluation: PlayerEvaluation;
  /** Any additional columns in the sheet beyond the known system columns */
  extraInfo: Record<string, string>;
}

export interface ScoutUpdatePayload {
  rowIndex: number;
  evaluation: PlayerEvaluation;
  score: number;
  pct: number;
  rating: string;
  remarks: string;
}

export interface ScoutApiResponse {
  players: ScoutPlayer[];
  isEditor: boolean;
}
