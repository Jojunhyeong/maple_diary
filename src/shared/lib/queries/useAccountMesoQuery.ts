'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type AccountMeso = {
  amount: number;
  updatedAt: string | null;
};

const LOCAL_STORAGE_PREFIX = 'maple_diary:account_meso:';

export const accountMesoQueryKeys = {
  all: ['account-meso'] as const,
  detail: (source: 'server' | 'local', ownerId: string) =>
    [...accountMesoQueryKeys.all, source, ownerId] as const,
};

function localStorageKey(localOwnerId: string) {
  return `${LOCAL_STORAGE_PREFIX}${localOwnerId}`;
}

function readLocalAccountMeso(localOwnerId: string): AccountMeso {
  try {
    const raw = localStorage.getItem(localStorageKey(localOwnerId));
    if (!raw) return { amount: 0, updatedAt: null };
    const parsed = JSON.parse(raw) as Partial<AccountMeso>;
    const amount = Number(parsed.amount);
    return {
      amount: Number.isSafeInteger(amount) && amount >= 0 ? amount : 0,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
    };
  } catch {
    return { amount: 0, updatedAt: null };
  }
}

function saveLocalAccountMeso(localOwnerId: string, amount: number): AccountMeso {
  const value = { amount, updatedAt: new Date().toISOString() };
  localStorage.setItem(localStorageKey(localOwnerId), JSON.stringify(value));
  return value;
}

async function readApiError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return payload?.error || fallback;
}

async function fetchAccountMeso(localOwnerId: string | null, isLoggedIn: boolean) {
  if (!isLoggedIn) {
    return localOwnerId ? readLocalAccountMeso(localOwnerId) : { amount: 0, updatedAt: null };
  }

  const response = await fetch('/api/account-meso', { cache: 'no-store' });
  if (!response.ok) throw new Error(await readApiError(response, '보유 메소를 불러오지 못했어요.'));
  return (await response.json()) as AccountMeso;
}

async function persistAccountMeso(amount: number, localOwnerId: string | null, isLoggedIn: boolean) {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error('보유 메소는 0 이상의 정수로 입력해 주세요.');
  }
  if (!isLoggedIn) {
    if (!localOwnerId) throw new Error('사용자 초기화 중입니다. 잠시 후 다시 시도해 주세요.');
    return saveLocalAccountMeso(localOwnerId, amount);
  }

  const response = await fetch('/api/account-meso', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount }),
  });
  if (!response.ok) throw new Error(await readApiError(response, '보유 메소를 저장하지 못했어요.'));
  return (await response.json()) as AccountMeso;
}

export function useAccountMesoQuery({
  localOwnerId,
  userId,
  isLoggedIn = false,
}: {
  localOwnerId: string | null;
  userId?: string | null;
  isLoggedIn?: boolean;
}) {
  const source = isLoggedIn ? 'server' : 'local';
  const ownerId = isLoggedIn ? (userId ?? 'pending-session') : (localOwnerId ?? 'pending-local');

  return useQuery({
    queryKey: accountMesoQueryKeys.detail(source, ownerId),
    queryFn: () => fetchAccountMeso(localOwnerId, isLoggedIn),
    enabled: isLoggedIn || !!localOwnerId,
  });
}

export function useAccountMesoMutation({
  localOwnerId,
  userId,
  isLoggedIn = false,
}: {
  localOwnerId: string | null;
  userId?: string | null;
  isLoggedIn?: boolean;
}) {
  const queryClient = useQueryClient();
  const source = isLoggedIn ? 'server' : 'local';
  const ownerId = isLoggedIn ? (userId ?? 'pending-session') : (localOwnerId ?? 'pending-local');
  const queryKey = accountMesoQueryKeys.detail(source, ownerId);

  return useMutation({
    mutationFn: (amount: number) => persistAccountMeso(amount, localOwnerId, isLoggedIn),
    onSuccess: (value) => queryClient.setQueryData(queryKey, value),
  });
}
