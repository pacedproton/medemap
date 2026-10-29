import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { getCurrentUser } from '@/lib/auth/server';

export type ProfileConfig = {
  profile: {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    public: boolean;
    groups: string[];
    tables: string[];
    indicators: string[];
    exclude: {
      tables: string[];
      indicators: string[];
    };
    defaults: {
      view: 'map' | '3d' | 'chart' | 'table';
      chartType: string;
      timeRange: string;
      countries: string | string[];
    };
    metadata: {
      author: string;
      created: string;
      updated: string;
      version: string;
      tags: string[];
    };
  };
};

// Cache loaded profiles in memory
const profileCache = new Map<string, ProfileConfig>();

// Profile ids come from request parameters and end up in a file path, so only plain names are allowed
const SAFE_PROFILE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
export const isSafeProfileId = (id: unknown): id is string => typeof id === 'string' && SAFE_PROFILE_ID.test(id);

/**
 * Load all available profile configurations from YAML files
 */
export const loadAllProfiles = (): ProfileConfig[] => {
  const profilesDir = path.join(process.cwd(), 'config', 'profiles');

  if (!fs.existsSync(profilesDir)) {
    console.warn('Profiles directory not found:', profilesDir);
    return [];
  }

  const files = fs.readdirSync(profilesDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

  return files.map(file => {
    const filePath = path.join(profilesDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const config = yaml.load(content) as ProfileConfig;

    // Cache the profile
    profileCache.set(config.profile.id, config);

    return config;
  });
};

/**
 * Load a specific profile by ID
 */
export const loadProfile = (profileId: string): ProfileConfig | null => {
  if (!isSafeProfileId(profileId)) {
    return null;
  }

  // Check cache first
  if (profileCache.has(profileId)) {
    return profileCache.get(profileId)!;
  }

  // Load from file
  const profilePath = path.join(process.cwd(), 'config', 'profiles', `${profileId}.yaml`);

  if (!fs.existsSync(profilePath)) {
    return null;
  }

  const content = fs.readFileSync(profilePath, 'utf8');
  const config = yaml.load(content) as ProfileConfig;

  profileCache.set(profileId, config);

  return config;
};

/**
 * Get profiles accessible to the current user
 */
export const getAccessibleProfiles = async (): Promise<ProfileConfig[]> => {
  const allProfiles = loadAllProfiles();
  const user = await getCurrentUser();

  // Not authenticated - no profiles
  if (!user) {
    return [];
  }

  // Admin - all profiles
  if (user.role === 'admin') {
    return allProfiles;
  }

  // Filter profiles based on user permissions
  return allProfiles.filter(config => {
    const { id, public: isPublic } = config.profile;

    // Public profiles available to all authenticated users
    if (isPublic) return true;

    // Check if user has explicit permission
    return user.allowed_profiles?.includes(id) || false;
  });
};

/**
 * Check if current user can access a specific profile
 */
export const canAccessProfile = async (profileId: string): Promise<boolean> => {
  const profile = loadProfile(profileId);

  if (!profile) return false;

  const user = await getCurrentUser();

  if (!user) return false;
  if (user.role === 'admin') return true;
  if (profile.profile.public) return true;

  return user.allowed_profiles?.includes(profileId) || false;
};

/**
 * Apply profile filters to a data query
 * Returns the tables and indicators that should be included
 */
export const applyProfileFilters = (profileId: string) => {
  const profile = loadProfile(profileId);

  if (!profile) {
    throw new Error(`Profile not found: ${profileId}`);
  }

  const { groups, tables, indicators, exclude } = profile.profile;

  return {
    includedGroups: groups,
    includedTables: tables,
    includedIndicators: indicators,
    excludedTables: exclude.tables,
    excludedIndicators: exclude.indicators,
    defaults: profile.profile.defaults,
  };
};
