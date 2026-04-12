'use client';

import { useEffect, useState } from 'react';
import {
  CHARACTER_CHANGE_EVENT,
  readActiveCharacterId,
} from '@/shared/lib/character-storage';

export function useActiveCharacterId() {
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return readActiveCharacterId();
  });

  useEffect(() => {
    const sync = () => setActiveCharacterId(readActiveCharacterId());

    sync();
    window.addEventListener('storage', sync);
    window.addEventListener(CHARACTER_CHANGE_EVENT, sync);

    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(CHARACTER_CHANGE_EVENT, sync);
    };
  }, []);

  return activeCharacterId;
}
