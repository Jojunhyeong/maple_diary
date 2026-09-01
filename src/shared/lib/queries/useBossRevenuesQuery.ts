'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BossCycleType,
  BossRevenueRow,
  ChecklistState,
} from '@/shared/lib/boss-checklist';

type BossRevenueFilters = {
  userId?: string | null;
  isLoggedIn?: boolean;
  characterId?: string | null;
  start?: string;
  end?: string;
  weekKey?: string;
  cycleType?: BossCycleType;
};

export const bossRevenueQueryKeys = {
  all: ['boss-revenues'] as const,
  list: (userId: string, filters: Omit<BossRevenueFilters, 'userId' | 'isLoggedIn'>) =>
    [...bossRevenueQueryKeys.all, userId, filters] as const,
};

async function readApiError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as {
    error?: string;
    dbError?: { message?: string; hint?: string; details?: string };
  } | null;
  const detail = payload?.dbError
    ? [payload.dbError.message, payload.dbError.hint, payload.dbError.details].filter(Boolean).join(' | ')
    : payload?.error;
  return detail || fallback;
}

async function fetchBossRevenues(filters: Omit<BossRevenueFilters, 'userId' | 'isLoggedIn'>) {
  const params = new URLSearchParams();
  if (filters.characterId) params.set('characterId', filters.characterId);
  if (filters.start) params.set('start', filters.start);
  if (filters.end) params.set('end', filters.end);
  if (filters.weekKey) params.set('weekKey', filters.weekKey);
  if (filters.cycleType) params.set('cycleType', filters.cycleType);
  const response = await fetch(`/api/boss-revenues?${params.toString()}`);
  if (!response.ok) throw new Error(await readApiError(response, '보스 수익을 불러오지 못했어요'));
  const payload = (await response.json()) as BossRevenueRow[];
  return Array.isArray(payload) ? payload : [];
}

export function useBossRevenuesQuery({
  userId,
  isLoggedIn = false,
  ...filters
}: BossRevenueFilters) {
  return useQuery({
    queryKey: bossRevenueQueryKeys.list(userId ?? 'pending-session', filters),
    queryFn: () => fetchBossRevenues(filters),
    enabled: isLoggedIn && filters.characterId !== '',
  });
}

export function useBossRevenueMutations({ isLoggedIn = false }: { isLoggedIn?: boolean } = {}) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: bossRevenueQueryKeys.all });
  const saveMutation = useMutation({
    mutationFn: async ({
      weekKey,
      monthKey,
      characterId,
      state,
    }: {
      weekKey: string;
      monthKey: string;
      characterId: string;
      state: ChecklistState;
    }) => {
      if (!isLoggedIn) throw new Error('로그인이 필요합니다');
      const response = await fetch('/api/boss-revenues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekKey, monthKey, characterId, state }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, response.status === 409 ? '이미 저장된 상태예요' : '저장에 실패했어요'));
      }
      return (await response.json()) as { savedCycles?: BossCycleType[] };
    },
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: async ({
      weekKey,
      monthKey,
      characterId,
    }: {
      weekKey: string;
      monthKey: string;
      characterId: string;
    }) => {
      if (!isLoggedIn) throw new Error('로그인이 필요합니다');
      const params = new URLSearchParams({ weekKey, monthKey, characterId });
      const response = await fetch(`/api/boss-revenues?${params.toString()}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await readApiError(response, '삭제에 실패했어요'));
      return response.json();
    },
    onSuccess: invalidate,
  });

  return {
    saveBossRevenue: saveMutation.mutateAsync,
    deleteBossRevenue: deleteMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
