'use client';

import { useEffect, useState } from 'react';
import {
  CHARACTER_CHANGE_EVENT,
  isUuidLike,
  readActiveCharacterId,
} from '@/shared/lib/character-storage';

export function useActiveCharacterId() {
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const activeId = readActiveCharacterId();
    return isUuidLike(activeId) ? activeId : null;
  });

  useEffect(() => {
    const sync = () => {
      const activeId = readActiveCharacterId();
      setActiveCharacterId(isUuidLike(activeId) ? activeId : null);
    };

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
