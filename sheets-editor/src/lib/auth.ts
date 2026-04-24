/**
 * Authentication utilities.
 * Handles NextAuth session validation and permission checks.
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { isEditor } from '@/config';
import type { AppUser } from '@/types';

/**
 * Get the current user from the server session.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  return {
    email: session.user.email,
    name: session.user.name || 'Unknown',
    image: session.user.image || undefined,
    isEditor: isEditor(session.user.email),
  };
}

/**
 * Require authentication. Throws if not authenticated.
 */
export async function requireAuth(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError('Authentication required', 401);
  }
  return user;
}

/**
 * Require editor permissions. Throws if not an editor.
 */
export async function requireEditor(): Promise<AppUser> {
  const user = await requireAuth();
  if (!user.isEditor) {
    throw new AuthError('Editor permission required', 403);
  }
  return user;
}

/**
 * Custom auth error with HTTP status code.
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
