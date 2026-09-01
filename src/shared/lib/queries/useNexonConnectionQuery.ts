'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { expenseQueryKeys } from '@/shared/lib/queries/useExpensesQuery';

export type NexonConnection = {
  connected: boolean;
  apiKeyLast4?: string;
  nexonOuid?: string;
  starforceDiscountRate?: number;
  connectedAt?: string;
  lastSyncedAt?: string | null;
};

export const nexonConnectionQueryKeys = {
  all: ['nexon-connection'] as const,
  detail: (userId: string) => [...nexonConnectionQueryKeys.all, userId] as const,
};

async function readApiError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return payload?.error || fallback;
}

async function fetchConnection() {
  const response = await fetch('/api/nexon/connection', { cache: 'no-store' });
  if (!response.ok) throw new Error(await readApiError(response, '넥슨 연결 상태를 불러오지 못했어요.'));
  return (await response.json()) as NexonConnection;
}

export function useNexonConnectionQuery({
  userId,
  isLoggedIn = false,
}: {
  userId?: string | null;
  isLoggedIn?: boolean;
}) {
  return useQuery({
    queryKey: nexonConnectionQueryKeys.detail(userId ?? 'pending-session'),
    queryFn: fetchConnection,
    enabled: isLoggedIn,
  });
}

export function useNexonConnectionMutations({ isLoggedIn = false }: { isLoggedIn?: boolean } = {}) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: nexonConnectionQueryKeys.all });
  const connectMutation = useMutation({
    mutationFn: async ({ apiKey, starforceDiscountRate }: { apiKey: string; starforceDiscountRate: number }) => {
      if (!isLoggedIn) throw new Error('로그인이 필요합니다');
      const response = await fetch('/api/nexon/connection', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, starforceDiscountRate }),
      });
      if (!response.ok) throw new Error(await readApiError(response, '넥슨 API 키를 연결하지 못했어요.'));
      return (await response.json()) as NexonConnection;
    },
    onSuccess: invalidate,
  });
  const updateMutation = useMutation({
    mutationFn: async (starforceDiscountRate: number) => {
      if (!isLoggedIn) throw new Error('로그인이 필요합니다');
      const response = await fetch('/api/nexon/connection', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starforceDiscountRate }),
      });
      if (!response.ok) throw new Error(await readApiError(response, '할인 설정을 저장하지 못했어요.'));
      return (await response.json()) as NexonConnection;
    },
    onSuccess: invalidate,
  });
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!isLoggedIn) throw new Error('로그인이 필요합니다');
      const response = await fetch('/api/nexon/connection', { method: 'DELETE' });
      if (!response.ok) throw new Error(await readApiError(response, '넥슨 연결을 해제하지 못했어요.'));
      return (await response.json()) as NexonConnection;
    },
    onSuccess: invalidate,
  });
  const starforceSyncMutation = useMutation({
    mutationFn: async () => {
      if (!isLoggedIn) throw new Error('로그인이 필요합니다');
      const response = await fetch('/api/nexon/starforce/sync', { method: 'POST' });
      const payload = (await response.json()) as {
        error?: string;
        importedExpenses?: number;
        importedAttempts?: number;
        totalAmount?: number;
        skippedCount?: number;
      };
      if (!response.ok) throw new Error(payload.error || '강화비를 동기화하지 못했어요.');
      return payload;
    },
    onSuccess: async () => {
      await Promise.all([
        invalidate(),
        queryClient.invalidateQueries({ queryKey: expenseQueryKeys.all }),
      ]);
    },
  });

  return {
    connectNexon: connectMutation.mutateAsync,
    updateDiscountRate: updateMutation.mutateAsync,
    disconnectNexon: disconnectMutation.mutateAsync,
    syncStarforce: starforceSyncMutation.mutateAsync,
    isPending:
      connectMutation.isPending ||
      updateMutation.isPending ||
      disconnectMutation.isPending ||
      starforceSyncMutation.isPending,
    isStarforceSyncing: starforceSyncMutation.isPending,
  };
}
