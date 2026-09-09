'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { expenseQueryKeys } from '@/shared/lib/queries/useExpensesQuery';
import { accountMesoQueryKeys } from '@/shared/lib/queries/useAccountMesoQuery';

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
  const enhancementSyncMutation = useMutation({
    mutationFn: async () => {
      if (!isLoggedIn) throw new Error('로그인이 필요합니다');
      const endpoints = ['/api/nexon/starforce/sync', '/api/nexon/potential/sync'];
      const responses = await Promise.all(endpoints.map((endpoint) => fetch(endpoint, { method: 'POST' })));
      const payloads = (await Promise.all(responses.map((response) => response.json()))) as Array<{
        error?: string;
        importedExpenses?: number;
        importedAttempts?: number;
        totalAmount?: number;
        skippedCount?: number;
      }>;
      const failedIndex = responses.findIndex((response) => !response.ok);
      if (failedIndex >= 0) throw new Error(payloads[failedIndex].error || '강화비를 동기화하지 못했어요.');
      const totals = payloads.reduce<{
        importedExpenses: number;
        importedAttempts: number;
        totalAmount: number;
        skippedCount: number;
      }>(
        (total, payload) => ({
          importedExpenses: total.importedExpenses + (payload.importedExpenses ?? 0),
          importedAttempts: total.importedAttempts + (payload.importedAttempts ?? 0),
          totalAmount: total.totalAmount + (payload.totalAmount ?? 0),
          skippedCount: total.skippedCount + (payload.skippedCount ?? 0),
        }),
        { importedExpenses: 0, importedAttempts: 0, totalAmount: 0, skippedCount: 0 },
      );
      return {
        ...totals,
        starforceAttempts: payloads[0].importedAttempts ?? 0,
        potentialAttempts: payloads[1].importedAttempts ?? 0,
      };
    },
    onSuccess: async () => {
      await Promise.all([
        invalidate(),
        queryClient.invalidateQueries({ queryKey: expenseQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: accountMesoQueryKeys.all }),
      ]);
    },
  });

  return {
    connectNexon: connectMutation.mutateAsync,
    updateDiscountRate: updateMutation.mutateAsync,
    disconnectNexon: disconnectMutation.mutateAsync,
    syncEnhancements: enhancementSyncMutation.mutateAsync,
    syncStarforce: enhancementSyncMutation.mutateAsync,
    isPending:
      connectMutation.isPending ||
      updateMutation.isPending ||
      disconnectMutation.isPending ||
      enhancementSyncMutation.isPending,
    isEnhancementSyncing: enhancementSyncMutation.isPending,
    isStarforceSyncing: enhancementSyncMutation.isPending,
  };
}
