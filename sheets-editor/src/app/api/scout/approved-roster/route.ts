import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ensureTabExists, readTab } from '@/lib/sheets';
import { parsePackage } from '@/lib/team-packages';

export const dynamic = 'force-dynamic';

const TAB = 'TeamPackages';
const HEADERS = ['PackageId', 'CoachEmail', 'CoachName', 'PackageName', 'Status', 'Teams', 'SavedAt', 'Shared', 'ApprovedAt', 'ApprovedBy'];

async function checkAuthorized(userEmail: string, sheetKey: string): Promise<boolean> {
  try {
    const { rows } = await readTab('AuthorizedUsers', sheetKey);
    return rows.some((row) =>
      Object.entries(row)
        .filter(([k]) => k !== '__rowIndex')
        .some(([, v]) => typeof v === 'string' && v.trim().toLowerCase() === userEmail.toLowerCase())
    );
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sheetKey = url.searchParams.get('sheetKey') || 'tryout';
    const user = await requireAuth();
    const isDemo = sheetKey === 'demo';

    if (!isDemo && !(await checkAuthorized(user.email, sheetKey))) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
    }

    await ensureTabExists(TAB, HEADERS, sheetKey);
    const { rows } = await readTab(TAB, sheetKey);

    const approvedRow = rows.find((r) => String(r['Status'] || '') === 'approved');
    const approved = approvedRow ? parsePackage(approvedRow) : null;

    return NextResponse.json({ approved });
  } catch (error: any) {
    if (error.name === 'AuthError') return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('[GET /api/scout/approved-roster]', error);
    return NextResponse.json({ error: 'Failed to fetch approved roster' }, { status: 500 });
  }
}
