'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GatheringRevenue, GatheringItemTab } from '@/shared/types';

type GatheringFilters = {
  userId?: string | null;
  isLoggedIn?: boolean;
  characterId?: string | null;
  start: string;
  end: string;
};

type GatheringEntry = {
  itemId?: string;
  itemName: string;
  itemTab: GatheringItemTab;
  quantity: number;
  unitPrice: number;
};

export const gatheringRevenueQueryKeys = {
  all: ['gathering-revenues'] as const,
  list: (userId: string, filters: Omit<GatheringFilters, 'userId' | 'isLoggedIn'>) =>
    [...gatheringRevenueQueryKeys.all, userId, filters] as const,
};

async function readApiError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return payload?.error || fallback;
}

async function fetchGatheringRevenues(filters: Omit<GatheringFilters, 'userId' | 'isLoggedIn'>) {
  const params = new URLSearchParams({ start: filters.start, end: filters.end });
  if (filters.characterId) params.set('characterId', filters.characterId);
  const response = await fetch(`/api/gathering-revenues?${params.toString()}`);
  if (!response.ok) throw new Error(await readApiError(response, '채집 기록을 불러오지 못했어요'));
  const payload = (await response.json()) as GatheringRevenue[];
  return Array.isArray(payload) ? payload : [];
}

export function useGatheringRevenuesQuery({
  userId,
  isLoggedIn = false,
  ...filters
}: GatheringFilters) {
  return useQuery({
    queryKey: gatheringRevenueQueryKeys.list(userId ?? 'pending-session', filters),
    queryFn: () => fetchGatheringRevenues(filters),
    enabled: isLoggedIn && filters.characterId !== '',
  });
}

export function useGatheringRevenueMutations({ isLoggedIn = false }: { isLoggedIn?: boolean } = {}) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: gatheringRevenueQueryKeys.all });
  const saveMutation = useMutation({
    mutationFn: async ({
      date,
      characterId,
      entries,
    }: {
      date: string;
      characterId: string;
      entries: GatheringEntry[];
    }) => {
      if (!isLoggedIn) throw new Error('로그인이 필요합니다');
      const response = await fetch('/api/gathering-revenues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, characterId, entries }),
      });
      if (!response.ok) throw new Error(await readApiError(response, '채집 저장에 실패했어요'));
      return (await response.json()) as GatheringRevenue[];
    },
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!isLoggedIn) throw new Error('로그인이 필요합니다');
      const response = await fetch(`/api/gathering-revenues/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await readApiError(response, '채집 삭제에 실패했어요'));
      return id;
    },
    onSuccess: invalidate,
  });

  return {
    saveGatheringRevenue: saveMutation.mutateAsync,
    deleteGatheringRevenue: deleteMutation.mutateAsync,
    isSaving: saveMutation.isPending || deleteMutation.isPending,
  };
}
