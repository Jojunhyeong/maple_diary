'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { recordQueryKeys } from '@/shared/lib/queries/useRecordsQuery';
import type { LocalCharacterProfile } from '@/shared/lib/character-storage';

type CharacterApiItem = Partial<LocalCharacterProfile> & {
  id?: string;
  character_name?: string;
  is_active?: boolean;
};

export type CharactersPayload = {
  characters: CharacterApiItem[];
  activeCharacter?: CharacterApiItem | null;
};

export const characterQueryKeys = {
  all: ['characters'] as const,
  list: (userId: string) => [...characterQueryKeys.all, userId] as const,
};

async function readApiError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return payload?.error || fallback;
}

async function fetchCharacters() {
  const response = await fetch('/api/characters');
  if (!response.ok) throw new Error(await readApiError(response, '캐릭터를 불러오지 못했습니다'));
  const payload = (await response.json()) as CharactersPayload;
  return {
    characters: Array.isArray(payload.characters) ? payload.characters : [],
    activeCharacter: payload.activeCharacter ?? null,
  };
}

export function useCharactersQuery({
  userId,
  isLoggedIn = false,
}: {
  userId?: string | null;
  isLoggedIn?: boolean;
}) {
  return useQuery({
    queryKey: characterQueryKeys.list(userId ?? 'pending-session'),
    queryFn: fetchCharacters,
    enabled: isLoggedIn,
  });
}

export function useCharacterMutations({ isLoggedIn = false }: { isLoggedIn?: boolean } = {}) {
  const queryClient = useQueryClient();
  const invalidateCharacters = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: characterQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: recordQueryKeys.all }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: async (character: CharacterApiItem) => {
      if (!isLoggedIn) return {} as { characterId?: string };
      const response = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(character),
      });
      if (!response.ok) throw new Error(await readApiError(response, '캐릭터 저장에 실패했습니다'));
      return (await response.json().catch(() => ({}))) as { characterId?: string };
    },
    onSuccess: invalidateCharacters,
  });

  const deleteMutation = useMutation({
    mutationFn: async ({
      characterId,
      characterName,
      characterOcid,
    }: {
      characterId: string;
      characterName: string;
      characterOcid?: string | null;
    }) => {
      if (!isLoggedIn) return;
      const response = await fetch(`/api/characters/${encodeURIComponent(characterId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterName, characterOcid: characterOcid ?? null }),
      });
      if (!response.ok) throw new Error(await readApiError(response, '캐릭터 삭제에 실패했습니다'));
    },
    onSuccess: invalidateCharacters,
  });

  return {
    saveCharacter: saveMutation.mutateAsync,
    deleteCharacter: deleteMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    isDeleting: deleteMutation.isPending,
    error: saveMutation.error ?? deleteMutation.error,
  };
}
