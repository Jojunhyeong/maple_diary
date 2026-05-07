'use client';

import { useEffect, useState } from 'react';
import {
  CHARACTER_CHANGE_EVENT,
  CHARACTER_STORAGE_KEYS,
  isUuidLike,
  readActiveCharacterId,
  readLocalCharacters,
  type LocalCharacterProfile,
} from '@/shared/lib/character-storage';

function readStoredProfile(): LocalCharacterProfile | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(CHARACTER_STORAGE_KEYS.LEGACY_PROFILE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalCharacterProfile;
    if (!parsed || typeof parsed.character_name !== 'string') return null;
    return parsed;
  } catch {
    // fall through to the character list below
  }

  const activeId = readActiveCharacterId();
  const characters = readLocalCharacters();
  if (characters.length === 0) return null;

  if (activeId && isUuidLike(activeId)) {
    const activeCharacter = characters.find((character) => character.id === activeId);
    if (activeCharacter) return activeCharacter;
  }

  return characters[0] || null;
}

export function useStoredCharacterProfile() {
  const [profile, setProfile] = useState<LocalCharacterProfile | null>(() => readStoredProfile());

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
