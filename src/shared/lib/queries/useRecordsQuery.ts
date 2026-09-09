'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  backfillRecordsCharacterId,
  deleteRecord as deleteLocalRecord,
  getRecordsByOwner,
  saveRecord,
} from '@/shared/lib/db/local';
import { enrichRecordWithCalculations } from '@/shared/lib/utils/calculations';
import {
  accountMesoQueryKeys,
  applyLocalAccountMesoDelta,
} from '@/shared/lib/queries/useAccountMesoQuery';
import type { Record, RecordWithCalculations } from '@/shared/types';

type RecordDraft = Omit<Record, 'id' | 'created_at' | 'updated_at'>;

type RecordsQueryOptions = {
  localOwnerId: string | null;
  userId?: string | null;
  isLoggedIn?: boolean;
  activeCharacterId?: string | null;
  initialData?: RecordWithCalculations[];
};

type RecordMutationOptions = {
  localOwnerId: string | null;
  isLoggedIn?: boolean;
};

export const recordQueryKeys = {
  all: ['records'] as const,
  list: (
    source: 'server' | 'local',
    ownerId: string,
    activeCharacterId: string | null,
  ) => [...recordQueryKeys.all, source, ownerId, activeCharacterId] as const,
};

function getShardPrice() {
  try {
    const raw = localStorage.getItem('maple_diary:settings');
    if (!raw) return 7_000_000;
    const settings = JSON.parse(raw) as { shard_price?: number };
    return settings.shard_price ?? 7_000_000;
  } catch {
    return 7_000_000;
  }
}

function normalizeLegacyRecords<T extends Record>(records: T[], characterId: string | null) {
  if (!characterId) return records;
  return records.map((record) =>
    record.character_id ? record : { ...record, character_id: characterId },
  );
}

function sortRecords(records: RecordWithCalculations[]) {
  return [...records].sort(
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

async function loadRecords({
  localOwnerId,
  isLoggedIn,
  activeCharacterId,
}: Omit<RecordsQueryOptions, 'initialData'>) {
  const shardPrice = getShardPrice();

  if (isLoggedIn) {
    const response = await fetch('/api/records');
    if (!response.ok) {
      throw new Error(await readApiError(response, '서버에서 기록을 불러오지 못했습니다'));
    }

    const payload = (await response.json()) as Record[];
    const rawRecords = Array.isArray(payload) ? payload : [];
    const normalizedRecords = normalizeLegacyRecords(rawRecords, activeCharacterId ?? null);
    const hasLegacyRecords = rawRecords.some((record) => !record.character_id);

    if (hasLegacyRecords && activeCharacterId) {
      const backfillResponse = await fetch('/api/records/backfill-character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: activeCharacterId }),
      });
      if (!backfillResponse.ok) {
        throw new Error(
          await readApiError(backfillResponse, '기존 기록의 캐릭터 정보를 연결하지 못했습니다'),
        );
      }
    }

    return sortRecords(
      normalizedRecords.map((record) => enrichRecordWithCalculations(record, shardPrice)),
    );
  }

  if (!localOwnerId) return [];

  const rawRecords = await getRecordsByOwner(localOwnerId);
  const normalizedRecords = normalizeLegacyRecords(rawRecords, activeCharacterId ?? null);
  const hasLegacyRecords = rawRecords.some((record) => !record.character_id);

  if (hasLegacyRecords && activeCharacterId) {
    await backfillRecordsCharacterId(localOwnerId, activeCharacterId);
  }

  return sortRecords(
    normalizedRecords.map((record) => enrichRecordWithCalculations(record, shardPrice)),
  );
}

async function createRecord(
  record: RecordDraft,
  localOwnerId: string,
  shardPrice: number,
  isLoggedIn: boolean,
) {
  const newRecord: Record = {
    id: crypto.randomUUID(),
    ...record,
    local_owner_id: localOwnerId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sync_status: 'local',
  };

  if (!isLoggedIn) {
    await saveRecord(newRecord, localOwnerId);
    const saved = enrichRecordWithCalculations(newRecord, shardPrice);
    applyLocalAccountMesoDelta(localOwnerId, saved.net_revenue, 'hunting', saved.id, '사냥 기록');
    return saved;
  }

  const response = await fetch('/api/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: newRecord.id,
      date: newRecord.date,
      time_minutes: newRecord.time_minutes,
      meso: newRecord.meso,
      shard_count: newRecord.shard_count,
      material_cost: newRecord.material_cost,
      memo: newRecord.memo,
      character_id: newRecord.character_id ?? null,
      shard_value: Math.floor(newRecord.shard_count * shardPrice),
      total_revenue: Math.floor(newRecord.meso + newRecord.shard_count * shardPrice),
      net_revenue: Math.floor(
        newRecord.meso + newRecord.shard_count * shardPrice - newRecord.material_cost,
      ),
      meso_per_hour:
        newRecord.time_minutes > 0
          ? Math.floor(newRecord.meso / (newRecord.time_minutes / 60))
          : 0,
      net_per_hour:
        newRecord.time_minutes > 0
          ? Math.floor(
              (newRecord.meso + newRecord.shard_count * shardPrice - newRecord.material_cost) /
                (newRecord.time_minutes / 60),
            )
          : 0,
      shard_per_hour:
        newRecord.time_minutes > 0
          ? Math.floor(newRecord.shard_count / (newRecord.time_minutes / 60))
          : 0,
      created_at: newRecord.created_at,
      updated_at: newRecord.updated_at,
    }),
  });
  if (!response.ok) throw new Error(await readApiError(response, '서버 저장 실패'));

  const savedRecord = (await response.json()) as Record;
  return enrichRecordWithCalculations(savedRecord, shardPrice);
}

async function updateRecord(
  record: Record,
  localOwnerId: string,
  shardPrice: number,
  isLoggedIn: boolean,
) {
  const updatedRecord: Record = {
    ...record,
    local_owner_id: record.local_owner_id ?? localOwnerId,
    updated_at: new Date().toISOString(),
  };

  if (!isLoggedIn) {
    const previous = (await getRecordsByOwner(localOwnerId)).find((item) => item.id === updatedRecord.id);
    await saveRecord(updatedRecord, localOwnerId);
    const saved = enrichRecordWithCalculations(updatedRecord, shardPrice);
    const previousNet = previous ? enrichRecordWithCalculations(previous, shardPrice).net_revenue : 0;
    applyLocalAccountMesoDelta(
      localOwnerId,
      saved.net_revenue - previousNet,
      'hunting',
      saved.id,
      '사냥 기록 수정',
    );
    return saved;
  }

  const calculated = enrichRecordWithCalculations(updatedRecord, shardPrice);
  const response = await fetch(`/api/records/${updatedRecord.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date: updatedRecord.date,
      time_minutes: updatedRecord.time_minutes,
      meso: updatedRecord.meso,
      shard_count: updatedRecord.shard_count,
      material_cost: updatedRecord.material_cost,
      memo: updatedRecord.memo,
      character_id: updatedRecord.character_id ?? null,
      shard_value: calculated.shard_value,
      total_revenue: calculated.total_revenue,
      net_revenue: calculated.net_revenue,
      meso_per_hour: calculated.meso_per_hour,
      net_per_hour: calculated.net_per_hour,
      shard_per_hour: calculated.shard_per_hour,
    }),
  });
  if (!response.ok) throw new Error(await readApiError(response, '서버 수정 실패'));

  const savedRecord = (await response.json()) as Record;
  return enrichRecordWithCalculations(savedRecord, shardPrice);
}

async function removeRecord(id: string, localOwnerId: string, isLoggedIn: boolean) {
  if (!isLoggedIn) {
    const previous = (await getRecordsByOwner(localOwnerId)).find((item) => item.id === id);
    await deleteLocalRecord(id);
    if (previous) {
      const previousNet = enrichRecordWithCalculations(previous, getShardPrice()).net_revenue;
      applyLocalAccountMesoDelta(localOwnerId, -previousNet, 'hunting', id, '사냥 기록 삭제');
    }
    return id;
  }

  const response = await fetch(`/api/records/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await readApiError(response, '서버 삭제 실패'));
  return id;
}

export function useRecordsQuery({
  localOwnerId,
  userId,
  isLoggedIn = false,
  activeCharacterId = null,
  initialData,
}: RecordsQueryOptions) {
  const source = isLoggedIn ? 'server' : 'local';
  const ownerId = isLoggedIn ? (userId ?? 'pending-session') : (localOwnerId ?? 'pending-local');

  return useQuery({
    queryKey: recordQueryKeys.list(source, ownerId, activeCharacterId),
    queryFn: () => loadRecords({ localOwnerId, isLoggedIn, activeCharacterId }),
    enabled: isLoggedIn || !!localOwnerId,
    initialData,
    initialDataUpdatedAt: initialData ? 0 : undefined,
  });
}

export function useRecordMutations({
  localOwnerId,
  isLoggedIn = false,
}: RecordMutationOptions) {
  const queryClient = useQueryClient();
  const invalidateRecords = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: recordQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: accountMesoQueryKeys.all }),
  ]);

  const createMutation = useMutation({
    mutationFn: ({ record, shardPrice }: { record: RecordDraft; shardPrice: number }) => {
      if (!localOwnerId) throw new Error('로컬 사용자 정보가 준비되지 않았습니다');
      return createRecord(record, localOwnerId, shardPrice, isLoggedIn);
    },
    onSuccess: invalidateRecords,
  });

  const updateMutation = useMutation({
    mutationFn: ({ record, shardPrice }: { record: Record; shardPrice: number }) => {
      if (!localOwnerId) throw new Error('로컬 사용자 정보가 준비되지 않았습니다');
      return updateRecord(record, localOwnerId, shardPrice, isLoggedIn);
    },
    onSuccess: invalidateRecords,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (!localOwnerId) throw new Error('로컬 사용자 정보가 준비되지 않았습니다');
      return removeRecord(id, localOwnerId, isLoggedIn);
    },
    onSuccess: invalidateRecords,
  });

  return {
    addRecord: (record: RecordDraft, shardPrice: number) =>
      createMutation.mutateAsync({ record, shardPrice }),
    updateRecord: (record: Record, shardPrice: number) =>
      updateMutation.mutateAsync({ record, shardPrice }),
    deleteRecord: (id: string) => deleteMutation.mutateAsync(id),
    isSaving: createMutation.isPending || updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    error: createMutation.error ?? updateMutation.error ?? deleteMutation.error,
    resetError: () => {
      createMutation.reset();
      updateMutation.reset();
      deleteMutation.reset();
    },
  };
}
