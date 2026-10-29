import { loadProfile, applyProfileFilters } from './loader';
import { getCurrentUser } from '../auth/server';

/**
 * Get profile filters for current request
 * Checks user permissions and returns filter configuration
 */
export async function getProfileFiltersForRequest(profileId?: string): Promise<ReturnType<typeof applyProfileFilters> | null> {
  const user = await getCurrentUser();

  // Not authenticated - no filters (or you could return default public filters)
  if (!user) {
    return null;
  }

  // No profile specified - no filtering
  if (!profileId) {
    return null;
  }

  // Admin has access to everything
  if (user.role === 'admin') {
    // Could still apply filters for UI purposes
    return applyProfileFilters(profileId);
  }

  // Load profile and check access
  const profile = loadProfile(profileId);
  if (!profile) {
    throw new Error(`Profile not found: ${profileId}`);
  }

  // Check if user can access this profile
  const canAccess =
    profile.profile.public ||
    user.allowed_profiles?.includes(profileId);

  if (!canAccess) {
    throw new Error(`User does not have access to profile: ${profileId}`);
  }

  // Return filters
  return applyProfileFilters(profileId);
}

/**
 * Filter table list based on profile configuration
 * Supports regex patterns for table matching
 */
export function filterTables(
  allTables: string[],
  filters: ReturnType<typeof applyProfileFilters> | null,
  tableGroupMap?: { [tableName: string]: string }
): string[] {
  // No filters - return all
  if (!filters) {
    return allTables;
  }

  const { includedGroups, includedTables, excludedTables } = filters;

  return allTables.filter(tableName => {
    // Check if explicitly excluded
    if (excludedTables.includes(tableName)) {
      return false;
    }

    // Check if explicitly included (exact match or regex pattern)
    for (const pattern of includedTables) {
      // If pattern contains *, treat as wildcard regex
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        if (regex.test(tableName)) {
          return true;
        }
      } else if (pattern === tableName) {
        return true;
      }
    }

    // Check if table's group is included
    if (tableGroupMap && tableGroupMap[tableName]) {
      const group = tableGroupMap[tableName];
      return includedGroups.includes(group);
    }

    // If we have group filters but no group mapping, exclude
    if (includedGroups.length > 0 && !tableGroupMap) {
      return false;
    }

    // No group filters - include everything not explicitly excluded
    return true;
  });
}

/**
 * Filter indicators/columns based on profile configuration
 * Supports regex patterns for indicator matching
 */
export function filterIndicators(
  allIndicators: string[],
  filters: ReturnType<typeof applyProfileFilters> | null
): string[] {
  // No filters - return all
  if (!filters) {
    return allIndicators;
  }

  const { includedIndicators, excludedIndicators } = filters;

  // If no included indicators specified, include all (except excluded)
  if (includedIndicators.length === 0) {
    return allIndicators.filter(ind => !excludedIndicators.includes(ind));
  }

  // Otherwise, only include specified indicators (and exclude excluded ones)
  return allIndicators.filter(ind => {
    // Check if explicitly excluded
    if (excludedIndicators.includes(ind)) {
      return false;
    }

    // Check if explicitly included (exact match or regex pattern)
    for (const pattern of includedIndicators) {
      // If pattern contains *, treat as wildcard regex
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        if (regex.test(ind)) {
          return true;
        }
      } else if (pattern === ind) {
        return true;
      }
    }

    return false;
  });
}
