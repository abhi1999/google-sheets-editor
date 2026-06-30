import type { OpportunityEntry } from '@/types/scout';

export function emptyOpportunityEntry(playerRowIndex: number): OpportunityEntry {
  return { playerRowIndex, battingOrder: null, bowlingOrder: null, oversBowled: 0 };
}

function asNumberOrNull(v: unknown): number | null {
  return typeof v === 'number' && !Number.isNaN(v) ? v : null;
}

export function parseOpportunityEntries(json: string): OpportunityEntry[] {
  try {
    if (!json || json.trim() === '') return [];
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => e && typeof e.playerRowIndex === 'number')
      .map((e) => ({
        playerRowIndex: e.playerRowIndex,
        battingOrder: asNumberOrNull(e.battingOrder),
        bowlingOrder: asNumberOrNull(e.bowlingOrder),
        oversBowled: typeof e.oversBowled === 'number' && !Number.isNaN(e.oversBowled) ? e.oversBowled : 0,
      }));
  } catch {
    return [];
  }
}
