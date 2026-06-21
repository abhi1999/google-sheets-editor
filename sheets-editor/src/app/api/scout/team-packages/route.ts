import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ensureTabExists, readTab, appendRowsToTab, updateRowInTab } from '@/lib/sheets';
import type { TeamPackage, PackageTeam } from '@/types/scout';

export const dynamic = 'force-dynamic';

const TAB = 'TeamPackages';
const HEADERS = ['PackageId', 'CoachEmail', 'CoachName', 'PackageName', 'Status', 'Teams', 'SavedAt'];
const MAX_PACKAGES = 5;

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

function parsePackage(r: Record<string, unknown>): TeamPackage {
  let teams: PackageTeam[] = [];
  try { teams = JSON.parse(String(r['Teams'] || '[]')); } catch {}
  return {
    packageId: String(r['PackageId'] || ''),
    coachEmail: String(r['CoachEmail'] || ''),
    coachName: String(r['CoachName'] || ''),
    packageName: String(r['PackageName'] || 'Default'),
    status: (String(r['Status'] || 'draft') as 'draft' | 'submitted'),
    teams,
    savedAt: String(r['SavedAt'] || ''),
  };
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

    const packages = rows
      .filter((r) => String(r['PackageId'] || '').trim().length > 0)
      .map(parsePackage);

    return NextResponse.json({ packages });
  } catch (error: any) {
    if (error.name === 'AuthError') return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('[GET /api/scout/team-packages]', error);
    return NextResponse.json({ error: 'Failed to fetch packages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sheetKey = url.searchParams.get('sheetKey') || 'tryout';
    const user = await requireAuth();
    const isDemo = sheetKey === 'demo';

    if (!isDemo && !(await checkAuthorized(user.email, sheetKey))) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
    }

    const body = await request.json() as {
      packageId?: string;
      packageName?: string;
      status?: 'draft' | 'submitted';
      teams: PackageTeam[];
    };

    await ensureTabExists(TAB, HEADERS, sheetKey);
    const { rows } = await readTab(TAB, sheetKey);

    const myRows = rows.filter(
      (r) =>
        String(r['PackageId'] || '').trim().length > 0 &&
        String(r['CoachEmail'] || '').toLowerCase() === user.email.toLowerCase()
    );

    const existingRow = body.packageId
      ? rows.find(
          (r) =>
            String(r['PackageId']) === body.packageId &&
            String(r['CoachEmail']).toLowerCase() === user.email.toLowerCase()
        )
      : null;

    if (!existingRow && myRows.length >= MAX_PACKAGES) {
      return NextResponse.json({ error: `Maximum ${MAX_PACKAGES} packages per coach` }, { status: 400 });
    }

    const packageId = body.packageId || `${user.email}_${Date.now()}`;
    const rowValues = [
      packageId,
      user.email,
      user.name,
      body.packageName || 'Default',
      body.status || 'draft',
      JSON.stringify(body.teams),
      new Date().toISOString(),
    ];

    if (existingRow) {
      await updateRowInTab(existingRow.__rowIndex as number, rowValues, TAB, sheetKey);
    } else {
      await appendRowsToTab([rowValues], TAB, sheetKey);
    }

    return NextResponse.json({ success: true, packageId });
  } catch (error: any) {
    if (error.name === 'AuthError') return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('[POST /api/scout/team-packages]', error);
    return NextResponse.json({ error: 'Failed to save package' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sheetKey = url.searchParams.get('sheetKey') || 'tryout';
    const packageId = url.searchParams.get('packageId');

    if (!packageId) return NextResponse.json({ error: 'packageId required' }, { status: 400 });

    const user = await requireAuth();
    const isDemo = sheetKey === 'demo';

    if (!isDemo && !(await checkAuthorized(user.email, sheetKey))) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
    }

    await ensureTabExists(TAB, HEADERS, sheetKey);
    const { rows } = await readTab(TAB, sheetKey);

    const row = rows.find(
      (r) =>
        String(r['PackageId']) === packageId &&
        String(r['CoachEmail']).toLowerCase() === user.email.toLowerCase()
    );

    if (!row) return NextResponse.json({ error: 'Package not found' }, { status: 404 });

    // Clear the row — blank PackageId means it will be filtered out on future reads
    await updateRowInTab(row.__rowIndex as number, ['', '', '', '', '', '', ''], TAB, sheetKey);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.name === 'AuthError') return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('[DELETE /api/scout/team-packages]', error);
    return NextResponse.json({ error: 'Failed to delete package' }, { status: 500 });
  }
}
