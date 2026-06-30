import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ensureTabExists, readTab, updateRowInTab } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

const TAB = 'TeamPackages';
const HEADERS = ['PackageId', 'CoachEmail', 'CoachName', 'PackageName', 'Status', 'Teams', 'SavedAt', 'Shared', 'ApprovedAt', 'ApprovedBy'];

async function checkAdmin(userEmail: string, sheetKey: string): Promise<boolean> {
  try {
    const { rows } = await readTab('AdminUsers', sheetKey);
    return rows.some((row) =>
      Object.entries(row)
        .filter(([k]) => k !== '__rowIndex')
        .some(([, v]) => typeof v === 'string' && v.trim().toLowerCase() === userEmail.toLowerCase())
    );
  } catch {
    return false;
  }
}

function rowValuesFor(r: Record<string, unknown>, overrides: Partial<Record<string, string>>): string[] {
  const merged = {
    PackageId: String(r['PackageId'] || ''),
    CoachEmail: String(r['CoachEmail'] || ''),
    CoachName: String(r['CoachName'] || ''),
    PackageName: String(r['PackageName'] || ''),
    Status: String(r['Status'] || 'draft'),
    Teams: String(r['Teams'] || '[]'),
    SavedAt: String(r['SavedAt'] || ''),
    Shared: String(r['Shared'] || 'FALSE'),
    ApprovedAt: String(r['ApprovedAt'] || ''),
    ApprovedBy: String(r['ApprovedBy'] || ''),
    ...overrides,
  };
  return [
    merged.PackageId, merged.CoachEmail, merged.CoachName, merged.PackageName,
    merged.Status, merged.Teams, merged.SavedAt, merged.Shared, merged.ApprovedAt, merged.ApprovedBy,
  ];
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sheetKey = url.searchParams.get('sheetKey') || 'tryout';
    const user = await requireAuth();
    const isDemo = sheetKey === 'demo';

    if (!isDemo && !(await checkAdmin(user.email, sheetKey))) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
    }

    const body = (await request.json()) as { packageId?: string };
    if (!body.packageId) {
      return NextResponse.json({ error: 'packageId required' }, { status: 400 });
    }

    await ensureTabExists(TAB, HEADERS, sheetKey);
    const { rows } = await readTab(TAB, sheetKey);

    const target = rows.find((r) => String(r['PackageId']) === body.packageId);
    if (!target) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Demote any previously-approved package(s) first so only one stays approved.
    const previouslyApproved = rows.filter(
      (r) => String(r['Status']) === 'approved' && String(r['PackageId']) !== body.packageId
    );
    for (const r of previouslyApproved) {
      await updateRowInTab(
        r.__rowIndex as number,
        rowValuesFor(r, { Status: 'submitted', ApprovedAt: '', ApprovedBy: '' }),
        TAB,
        sheetKey
      );
    }

    await updateRowInTab(
      target.__rowIndex as number,
      rowValuesFor(target, { Status: 'approved', ApprovedAt: now, ApprovedBy: user.email }),
      TAB,
      sheetKey
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.name === 'AuthError') return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('[POST /api/scout/team-packages/approve]', error);
    return NextResponse.json({ error: error.message || 'Failed to approve package' }, { status: 500 });
  }
}
