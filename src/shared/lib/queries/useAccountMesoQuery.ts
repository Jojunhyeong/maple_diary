'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rememberMesoBalance } from '@/shared/lib/account-meso-history-storage';

export type AccountMeso = {
  amount: number;
  updatedAt: string | null;
  history: AccountMesoHistoryEntry[];
};

export type AccountMesoHistoryEntry = {
  id: string;
  amountBefore: number;
  amountAfter: number;
  delta: number;
  entryType: 'initial_balance' | 'manual_adjustment' | 'hunting' | 'expense' | 'gathering' | 'boss';
  sourceId?: string | null;
  note?: string | null;
  createdAt: string;
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

export function readLocalAccountMeso(localOwnerId: string): AccountMeso {
  try {
    const raw = localStorage.getItem(localStorageKey(localOwnerId));
    if (!raw) return { amount: 0, updatedAt: null, history: [] };
    const parsed = JSON.parse(raw) as Partial<AccountMeso>;
    const amount = Number(parsed.amount);
    return {
      amount: Number.isSafeInteger(amount) ? amount : 0,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
      history: Array.isArray(parsed.history) ? parsed.history as AccountMesoHistoryEntry[] : [],
    };
  } catch {
    return { amount: 0, updatedAt: null, history: [] };
  }
}

function saveLocalAccountMeso(localOwnerId: string, amount: number, note?: string): AccountMeso {
  const previous = readLocalAccountMeso(localOwnerId);
  const updatedAt = new Date().toISOString();
  const entryType = previous.updatedAt ? 'manual_adjustment' : 'initial_balance';
  const history = amount === previous.amount && previous.updatedAt
    ? previous.history
    : [{
        id: crypto.randomUUID(),
        amountBefore: previous.amount,
        amountAfter: amount,
        delta: amount - previous.amount,
        entryType,
        sourceId: null,
        note: note?.trim() || null,
        createdAt: updatedAt,
      } satisfies AccountMesoHistoryEntry, ...previous.history].slice(0, 100);
  const value = { amount, updatedAt, history };
  localStorage.setItem(localStorageKey(localOwnerId), JSON.stringify(value));
  return value;
}

export function applyLocalAccountMesoDelta(
  localOwnerId: string,
  delta: number,
  entryType: AccountMesoHistoryEntry['entryType'],
  sourceId: string,
  note: string,
) {
  const previous = readLocalAccountMeso(localOwnerId);
  if (!previous.updatedAt || !Number.isSafeInteger(delta) || delta === 0) return previous;
  const updatedAt = new Date().toISOString();
  const value: AccountMeso = {
    amount: previous.amount + delta,
    updatedAt,
    history: [{
      id: crypto.randomUUID(),
      amountBefore: previous.amount,
      amountAfter: previous.amount + delta,
      delta,
      entryType,
      sourceId,
      note,
      createdAt: updatedAt,
    }, ...previous.history].slice(0, 100),
  };
  localStorage.setItem(localStorageKey(localOwnerId), JSON.stringify(value));
  rememberMesoBalance(`local:${localOwnerId}`, value);
  return value;
}

async function readApiError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return payload?.error || fallback;
}

async function fetchAccountMeso(localOwnerId: string | null, isLoggedIn: boolean) {
  if (!isLoggedIn) {
    return localOwnerId ? readLocalAccountMeso(localOwnerId) : { amount: 0, updatedAt: null, history: [] };
  }

  const response = await fetch('/api/account-meso', { cache: 'no-store' });
  if (!response.ok) throw new Error(await readApiError(response, '보유 메소를 불러오지 못했어요.'));
  return (await response.json()) as AccountMeso;
}

async function persistAccountMeso(
  input: { amount: number; note?: string },
  localOwnerId: string | null,
  isLoggedIn: boolean,
) {
  const { amount, note } = input;
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error('보유 메소는 0 이상의 정수로 입력해 주세요.');
  }
  if (!isLoggedIn) {
    if (!localOwnerId) throw new Error('사용자 초기화 중입니다. 잠시 후 다시 시도해 주세요.');
    return saveLocalAccountMeso(localOwnerId, amount, note);
  }

  const response = await fetch('/api/account-meso', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, note }),
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
    queryFn: async () => {
      const value = await fetchAccountMeso(localOwnerId, isLoggedIn);
      rememberMesoBalance(`${source}:${ownerId}`, value);
      return value;
    },
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
    mutationFn: (input: { amount: number; note?: string }) => persistAccountMeso(input, localOwnerId, isLoggedIn),
    onSuccess: (value) => {
      const previous = queryClient.getQueryData<AccountMeso>(queryKey);
      if (previous) rememberMesoBalance(`${source}:${ownerId}`, previous);
      rememberMesoBalance(`${source}:${ownerId}`, value);
      queryClient.setQueryData(queryKey, value);
    },
  });
}
