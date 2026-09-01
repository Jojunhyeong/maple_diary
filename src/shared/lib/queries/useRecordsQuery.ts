'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  backfillRecordsCharacterId,
  deleteRecord as deleteLocalRecord,
  getRecordsByOwner,
  saveRecord,
} from '@/shared/lib/db/local';
import { enrichRecordWithCalculations } from '@/shared/lib/utils/calculations';
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
    return enrichRecordWithCalculations(newRecord, shardPrice);
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
    await saveRecord(updatedRecord, localOwnerId);
    return enrichRecordWithCalculations(updatedRecord, shardPrice);
  }

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
    }),
  });
  if (!response.ok) throw new Error(await readApiError(response, '서버 수정 실패'));

  const savedRecord = (await response.json()) as Record;
  return enrichRecordWithCalculations(savedRecord, shardPrice);
}

async function removeRecord(id: string, isLoggedIn: boolean) {
  if (!isLoggedIn) {
    await deleteLocalRecord(id);
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
  const invalidateRecords = () => queryClient.invalidateQueries({ queryKey: recordQueryKeys.all });

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
    mutationFn: (id: string) => removeRecord(id, isLoggedIn),
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
