'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { getRecordsByOwner, getAllGoalsByOwner } from '@/shared/lib/db/local';
import { readLegacyProfile, readLocalCharacters, readActiveCharacterId } from '@/shared/lib/character-storage';

const MIGRATED_KEY = 'maple_diary:migrated';

export function useMigrateOnLogin() {
  const { data: session, status } = useSession();
  const migrating = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return;
    if (migrating.current) return;

    const alreadyMigrated = localStorage.getItem(MIGRATED_KEY);
    const localOwnerId = localStorage.getItem('maple_diary:local_owner_id');
    const characterMigrationKey = `maple_diary:migrated:characters:${session.user.id}`;

    migrating.current = true;

    (async () => {
      try {
        if (!localStorage.getItem(characterMigrationKey)) {
          const characters = readLocalCharacters();
          const legacyProfile = readLegacyProfile();
          const activeCharacterId = readActiveCharacterId();

          if (characters.length > 0 || legacyProfile) {
            const res = await fetch('/api/characters/migrate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                characters,
                profile: legacyProfile,
                activeCharacterId,
              }),
            });

            if (res.ok) {
              localStorage.setItem(characterMigrationKey, 'true');
            }
          } else {
            localStorage.setItem(characterMigrationKey, 'true');
          }
        }

        if (!alreadyMigrated) {
          if (!localOwnerId) {
            localStorage.setItem(MIGRATED_KEY, 'true');
            return;
          }

          const [records, goals] = await Promise.all([
            getRecordsByOwner(localOwnerId),
            getAllGoalsByOwner(localOwnerId),
          ]);

          if (records.length === 0 && goals.length === 0) {
            localStorage.setItem(MIGRATED_KEY, 'true');
            return;
          }

          const res = await fetch('/api/migrate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ records, goals }),
          });

          if (res.ok) {
            const { migratedRecords } = await res.json();
            console.log(`마이그레이션 완료: ${migratedRecords}개 기록`);
            localStorage.setItem(MIGRATED_KEY, 'true');
          }
        }
      } catch (err) {
        console.error('마이그레이션 실패:', err);
      } finally {
        migrating.current = false;
      }
    })();
  }, [status, session?.user?.id]);
}
