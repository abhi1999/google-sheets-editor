import type { TeamPackage, PackageTeam } from '@/types/scout';

export function parsePackage(r: Record<string, unknown>): TeamPackage {
  let teams: PackageTeam[] = [];
  try { teams = JSON.parse(String(r['Teams'] || '[]')); } catch {}
  return {
    packageId: String(r['PackageId'] || ''),
    coachEmail: String(r['CoachEmail'] || ''),
    coachName: String(r['CoachName'] || ''),
    packageName: String(r['PackageName'] || 'Default'),
    status: (String(r['Status'] || 'draft') as 'draft' | 'submitted' | 'approved'),
    shared: String(r['Shared'] || '').toUpperCase() === 'TRUE',
    teams,
    savedAt: String(r['SavedAt'] || ''),
    approvedAt: String(r['ApprovedAt'] || '') || undefined,
    approvedBy: String(r['ApprovedBy'] || '') || undefined,
  };
}
