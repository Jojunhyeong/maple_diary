'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAllGoalsByOwner, saveGoals as saveLocalGoals } from '@/shared/lib/db/local';
import type { Goal } from '@/shared/types';

type GoalDraft = Omit<Goal, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export const goalQueryKeys = {
  all: ['goals'] as const,
  list: (source: 'server' | 'local', ownerId: string) =>
    [...goalQueryKeys.all, source, ownerId] as const,
};

async function readGoalApiError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as {
    error?: string;
    dbError?: { message?: string };
  } | null;
  return payload?.dbError?.message || payload?.error || fallback;
}

async function fetchGoals(localOwnerId: string | null, isLoggedIn: boolean) {
  if (!isLoggedIn) return localOwnerId ? getAllGoalsByOwner(localOwnerId) : [];

  const response = await fetch('/api/goals');
  if (!response.ok) throw new Error(await readGoalApiError(response, '목표 불러오기 실패'));
  const payload = (await response.json()) as Goal[];
  return Array.isArray(payload) ? payload : [];
}

async function persistGoals(goals: GoalDraft[], localOwnerId: string, isLoggedIn: boolean) {
  const now = new Date().toISOString();
  const normalizedGoals: Goal[] = goals.map((goal) => ({
    ...goal,
    id: goal.id || crypto.randomUUID(),
    position: goal.position ?? 0,
    created_at: goal.created_at || now,
    updated_at: now,
  }));

  if (!isLoggedIn) {
    await saveLocalGoals(normalizedGoals, localOwnerId);
    return normalizedGoals;
  }

  const response = await fetch('/api/goals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goals: normalizedGoals }),
  });
  if (!response.ok) throw new Error(await readGoalApiError(response, '목표 저장 실패'));
  const payload = (await response.json()) as Goal[];
  return Array.isArray(payload) ? payload : [];
}

export function useGoalsQuery({
  localOwnerId,
  userId,
  isLoggedIn = false,
  initialData,
}: {
  localOwnerId: string | null;
  userId?: string | null;
  isLoggedIn?: boolean;
  initialData?: Goal[];
}) {
  const source = isLoggedIn ? 'server' : 'local';
  const ownerId = isLoggedIn ? (userId ?? 'pending-session') : (localOwnerId ?? 'pending-local');

  return useQuery({
    queryKey: goalQueryKeys.list(source, ownerId),
    queryFn: () => fetchGoals(localOwnerId, isLoggedIn),
    enabled: isLoggedIn || !!localOwnerId,
    initialData,
    initialDataUpdatedAt: initialData ? 0 : undefined,
  });
}

export function useGoalMutations({
  localOwnerId,
  isLoggedIn = false,
}: {
  localOwnerId: string | null;
  isLoggedIn?: boolean;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (goals: GoalDraft[]) => {
      if (!localOwnerId) throw new Error('사용자 초기화 중입니다. 잠시 후 다시 시도해주세요.');
      return persistGoals(goals, localOwnerId, isLoggedIn);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: goalQueryKeys.all }),
  });

  return {
    saveGoals: mutation.mutateAsync,
    error: mutation.error,
    isSaving: mutation.isPending,
    resetError: mutation.reset,
  };
}
