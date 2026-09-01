'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { Expense } from '@/shared/types';

type ExpenseDraft = Omit<Expense, 'id' | 'created_at' | 'updated_at' | 'sync_status'>;

export const expenseQueryKeys = {
  all: ['expenses'] as const,
  list: (userId: string) => [...expenseQueryKeys.all, userId] as const,
};

function sortExpenses(expenses: Expense[]) {
  return [...expenses].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      b.created_at.localeCompare(a.created_at) ||
      b.id.localeCompare(a.id),
  );
}

async function readApiError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return payload?.error || fallback;
}

async function fetchExpenses() {
  const response = await fetch('/api/expenses', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(await readApiError(response, '서버에서 지출을 불러오지 못했습니다'));
  }
  const payload = (await response.json()) as Expense[];
  return sortExpenses(Array.isArray(payload) ? payload : []);
}

async function createExpense(expense: ExpenseDraft) {
  const now = new Date().toISOString();
  const response = await fetch('/api/expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...expense,
      created_at: now,
      updated_at: now,
      sync_status: 'synced',
    }),
  });
  if (!response.ok) throw new Error(await readApiError(response, '서버 저장 실패'));
  return (await response.json()) as Expense;
}

async function updateExpense(expense: Expense) {
  const response = await fetch(`/api/expenses/${expense.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...expense, updated_at: new Date().toISOString(), sync_status: 'synced' }),
  });
  if (!response.ok) throw new Error(await readApiError(response, '서버 수정 실패'));
  return (await response.json()) as Expense;
}

async function deleteExpense(id: string) {
  const response = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await readApiError(response, '서버 삭제 실패'));
  return id;
}

export function useExpensesQuery({
  userId,
  isLoggedIn = false,
  initialData,
}: {
  userId?: string | null;
  isLoggedIn?: boolean;
  initialData?: Expense[];
}) {
  return useQuery({
    queryKey: expenseQueryKeys.list(userId ?? 'pending-session'),
    queryFn: fetchExpenses,
    enabled: isLoggedIn,
    initialData,
    initialDataUpdatedAt: initialData ? 0 : undefined,
  });
}

export function useExpenseMutations({ isLoggedIn = false }: { isLoggedIn?: boolean } = {}) {
  const queryClient = useQueryClient();
  const invalidateExpenses = () => queryClient.invalidateQueries({ queryKey: expenseQueryKeys.all });

  const createMutation = useMutation({
    mutationFn: (expense: ExpenseDraft) => {
      if (!isLoggedIn) throw new Error('로그인이 필요합니다');
      return createExpense(expense);
    },
    onSuccess: invalidateExpenses,
  });
  const updateMutation = useMutation({
    mutationFn: (expense: Expense) => {
      if (!isLoggedIn) throw new Error('로그인이 필요합니다');
      return updateExpense(expense);
    },
    onSuccess: invalidateExpenses,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (!isLoggedIn) throw new Error('로그인이 필요합니다');
      return deleteExpense(id);
    },
    onSuccess: invalidateExpenses,
  });
  const resetCreateMutation = createMutation.reset;
  const resetUpdateMutation = updateMutation.reset;
  const resetDeleteMutation = deleteMutation.reset;
  const resetError = useCallback(() => {
    resetCreateMutation();
    resetUpdateMutation();
    resetDeleteMutation();
  }, [resetCreateMutation, resetDeleteMutation, resetUpdateMutation]);

  return {
    addExpense: createMutation.mutateAsync,
    updateExpense: updateMutation.mutateAsync,
    deleteExpense: deleteMutation.mutateAsync,
    error: createMutation.error ?? updateMutation.error ?? deleteMutation.error,
    isSaving: createMutation.isPending || updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    resetError,
  };
}
