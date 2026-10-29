'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type ProfileContextType = {
  activeProfile: string | null;
  setActiveProfile: (profileId: string) => void;
};

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [activeProfile, setActiveProfileState] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('selectedProfile');
        if (saved) {
          setActiveProfileState(saved);
        }
      } catch (error) {
        // Silently fail if localStorage is not available
        console.warn('Failed to load profile from localStorage:', error);
      }
    }
  }, []);

  const setActiveProfile = (profileId: string) => {
    setActiveProfileState(profileId);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('selectedProfile', profileId);
        // Dispatch event for other components
        window.dispatchEvent(new CustomEvent('profileChanged', { detail: { profileId } }));
      } catch (error) {
        // Silently fail if localStorage is not available
        console.warn('Failed to save profile to localStorage:', error);
      }
    }
  };

  return (
    <ProfileContext.Provider value={{ activeProfile, setActiveProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
