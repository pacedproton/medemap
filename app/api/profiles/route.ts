import { NextResponse } from 'next/server';
import { serverLogger } from '../../../lib/logging/serverLogger';
import { getAccessibleProfiles } from '@/lib/profiles/loader';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const profiles = await getAccessibleProfiles();

    // Return simplified profile info for UI
    const profileData = profiles.map(config => ({
      id: config.profile.id,
      name: config.profile.name,
      description: config.profile.description,
      icon: config.profile.icon,
      color: config.profile.color,
      public: config.profile.public,
      tags: config.profile.metadata.tags,
    }));

    return NextResponse.json({
      profiles: profileData,
      count: profileData.length,
    });
  } catch (error: any) {
    serverLogger.error('Failed to load profiles', { component: 'profiles-api', error });
    return NextResponse.json(
      { error: 'Failed to load profiles' },
      { status: 500 }
    );
  }
}
