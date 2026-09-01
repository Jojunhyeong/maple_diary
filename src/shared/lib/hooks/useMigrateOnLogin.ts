'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { getRecordsByOwner, getAllGoalsByOwner, migrateRecordsCharacterId } from '@/shared/lib/db/local';
import {
  readLegacyProfile,
  readLocalCharacters,
  readActiveCharacterId,
  writeLocalCharacters,
} from '@/shared/lib/character-storage';

const MIGRATED_KEY = 'maple_diary:migrated';

export function useMigrateOnLogin() {
  const { data: session, status } = useSession();
  const migrating = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return;
    if (migrating.current) return;

    const alreadyMigrated = localStorage.getItem(MIGRATED_KEY);
    const localOwnerId = localStorage.getItem('maple_diary:local_owner_id');
    const characterMigrationKey = `maple_diary:migrated:characters:v2:${session.user.id}`;

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

            const result = (await res.json().catch(() => ({}))) as {
              activeCharacterId?: string | null;
              characterIdMap?: Record<string, string>;
              error?: string;
            };

            if (!res.ok) {
              throw new Error(result.error || '캐릭터 마이그레이션에 실패했어요.');
            }

            const characterIdMap = result.characterIdMap ?? {};
            const remappedCharacters = characters.map((character) => ({
              ...character,
              id: character.id ? characterIdMap[character.id] ?? character.id : character.id,
              is_active:
                !!result.activeCharacterId &&
                (characterIdMap[character.id ?? ''] ?? character.id) === result.activeCharacterId,
            }));

            if (localOwnerId) {
              for (const [fromId, toId] of Object.entries(characterIdMap)) {
                if (fromId !== toId) {
                  await migrateRecordsCharacterId(localOwnerId, fromId, toId);
                }
              }
            }

            if (remappedCharacters.length > 0) {
              writeLocalCharacters(remappedCharacters, result.activeCharacterId ?? null);
              const activeProfile = remappedCharacters.find(
                (character) => character.id === result.activeCharacterId,
              );
              if (activeProfile) {
                localStorage.setItem('maple_diary:user_profile', JSON.stringify(activeProfile));
              }
            }

            localStorage.setItem(characterMigrationKey, 'true');
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
