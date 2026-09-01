'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  CHARACTER_CHANGE_EVENT,
  isUuidLike,
  readActiveCharacterId,
} from '@/shared/lib/character-storage';

export function useActiveCharacterId() {
  const { data: session } = useSession();
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);
  const sessionActiveCharacterId = session?.user?.activeCharacterId;

  useEffect(() => {
    const sync = () => {
      const activeId = readActiveCharacterId();
      setActiveCharacterId(
        isUuidLike(activeId)
          ? activeId
          : isUuidLike(sessionActiveCharacterId)
            ? sessionActiveCharacterId
            : null,
      );
    };

    sync();
    window.addEventListener('storage', sync);
    window.addEventListener(CHARACTER_CHANGE_EVENT, sync);

    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(CHARACTER_CHANGE_EVENT, sync);
    };
  }, [sessionActiveCharacterId]);

  return activeCharacterId;
}
