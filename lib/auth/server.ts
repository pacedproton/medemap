import { auth } from '@/auth';

export type UserProfile = {
  id: string;
  email: string;
  role: 'admin' | 'researcher' | 'journalist' | 'viewer';
  allowed_profiles: string[];
  active: boolean;
};

/**
 * Get current authenticated user from session
 * Server-side only
 */
export const getCurrentUser = async (): Promise<UserProfile | null> => {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  return {
    id: session.user.id as string,
    email: session.user.email!,
    role: session.user.role as 'admin' | 'researcher' | 'journalist' | 'viewer',
    allowed_profiles: session.user.allowedProfiles as string[],
    active: true, // If they have a session, they're active
  };
};

/**
 * Check if current user can access a specific profile
 */
export const canAccessProfile = async (profileId: string): Promise<boolean> => {
  const user = await getCurrentUser();

  if (!user) return false;
  if (user.role === 'admin') return true;

  return user.allowed_profiles?.includes(profileId) || false;
};

/**
 * Check if current user is admin
 */
export const isAdmin = async (): Promise<boolean> => {
  const user = await getCurrentUser();
  return user?.role === 'admin' || false;
};

/**
 * Require authentication - throws if not authenticated
 */
export const requireAuth = async (): Promise<UserProfile> => {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Unauthorized: Authentication required');
  }

  return user;
};

/**
 * Require admin role - throws if not admin
 */
export const requireAdmin = async (): Promise<UserProfile> => {
  const user = await requireAuth();

  if (user.role !== 'admin') {
    throw new Error('Forbidden: Admin access required');
  }

  return user;
};
