'use client';

import { useState, useEffect } from 'react';
import {
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Box,
  Chip,
  Typography,
  SelectChangeEvent,
} from '@mui/material';
import * as Icons from '@mui/icons-material';
import { useProfile } from '@/lib/profiles/ProfileContext';
import { useSession } from 'next-auth/react';

type Profile = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  public: boolean;
};

export default function ProfileSelector() {
  const { activeProfile, setActiveProfile } = useProfile();
  const { data: session } = useSession();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user) {
      loadProfiles();
    } else {
      setLoading(false);
    }
  }, [session]);

  const loadProfiles = async () => {
    try {
      const response = await fetch('/api/profiles');
      const data = await response.json();
      setProfiles(data.profiles || []);

      // Set default to first profile if none selected
      if (!activeProfile && data.profiles.length > 0) {
        setActiveProfile(data.profiles[0].id);
      }
    } catch (error) {
      console.error('Failed to load profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (event: SelectChangeEvent) => {
    setActiveProfile(event.target.value);
  };

  if (!session?.user || loading || profiles.length === 0) {
    return null;
  }

  const currentProfile = profiles.find(p => p.id === activeProfile);

  return (
    <Box sx={{ minWidth: 200 }}>
      <FormControl fullWidth size="small">
        <InputLabel id="profile-select-label">Data Profile</InputLabel>
        <Select
          labelId="profile-select-label"
          id="profile-select"
          value={activeProfile || ''}
          label="Data Profile"
          onChange={handleChange}
          renderValue={(value) => {
            const profile = profiles.find(p => p.id === value);
            if (!profile) return value;

            const IconComponent = (Icons as any)[profile.icon] || Icons.Dashboard;

            return (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconComponent sx={{ fontSize: 20, color: profile.color }} />
                <Typography variant="body2">{profile.name}</Typography>
                {profile.public && (
                  <Chip label="Public" size="small" sx={{ height: 20 }} />
                )}
              </Box>
            );
          }}
        >
          {profiles.map((profile) => {
            const IconComponent = (Icons as any)[profile.icon] || Icons.Dashboard;

            return (
              <MenuItem key={profile.id} value={profile.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <IconComponent sx={{ fontSize: 20, color: profile.color }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight="medium">
                      {profile.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {profile.description}
                    </Typography>
                  </Box>
                  {profile.public && (
                    <Chip label="Public" size="small" sx={{ height: 20 }} />
                  )}
                </Box>
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>

      {currentProfile && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {currentProfile.description}
        </Typography>
      )}
    </Box>
  );
}
