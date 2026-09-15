'use client';

import { useEffect, useState } from 'react';
import {
  CHARACTER_CHANGE_EVENT,
  readActiveCharacterId,
  readLocalCharacters,
  selectActiveCharacterProfile,
  type LocalCharacterProfile,
} from '@/shared/lib/character-storage';

function readStoredProfile(): LocalCharacterProfile | null {
  if (typeof window === 'undefined') return null;

  const activeId = readActiveCharacterId();
  const characters = readLocalCharacters();
  if (characters.length === 0) return null;

  // Selection events are emitted before the legacy profile is synchronized.
  // Prefer the selected entry in the current character list.
  return selectActiveCharacterProfile(characters, activeId);
}

export function useStoredCharacterProfile() {
  const [profile, setProfile] = useState<LocalCharacterProfile | null>(null);

  useEffect(() => {
    const sync = () => setProfile(readStoredProfile());

    sync();
    window.addEventListener('storage', sync);
    window.addEventListener(CHARACTER_CHANGE_EVENT, sync);

    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(CHARACTER_CHANGE_EVENT, sync);
    };
  }, []);

  return profile;
}
