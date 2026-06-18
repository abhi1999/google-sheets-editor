export type SchemaType = 'Batsman' | 'Fast Bowler' | 'Spin Bowler';

export interface PlayerEvaluation {
  skills: Record<string, number>;
  notes: Record<string, string>;
}

export interface ScoutPlayer {
  rowIndex: number;
  name: string;
  category: string;
  schema: SchemaType;
  score: number;
  pct: number;
  rating: string;
  remarks: string;
  evaluation: PlayerEvaluation;
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
