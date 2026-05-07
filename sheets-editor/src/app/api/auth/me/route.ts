import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

/**
 * GET /api/auth/me
 * Returns the current authenticated user's info including editor status.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sheetKey = url.searchParams.get('sheetKey') || undefined;
  const user = await getCurrentUser(sheetKey);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json(user);
}
