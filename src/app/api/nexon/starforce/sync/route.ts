import { NextResponse } from 'next/server';
import { auth } from '@/../auth';
import { supabaseAdmin } from '@/shared/lib/supabase';
import { decryptNexonApiKey } from '@/shared/lib/server/nexon-api-key';
import {
  calculateStarforceHistory,
  type CalculatedStarforceHistory,
  type NexonStarforceHistory,
  type StarforceSkipReason,
} from '@/shared/lib/server/starforce-cost';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NEXON_STARFORCE_URL = 'https://open.api.nexon.com/maplestory/v1/history/starforce';
const INITIAL_SYNC_DAYS = 7;
const MAX_SYNC_DAYS = 31;
const PAGE_SIZE = 1000;
const MAX_PAGES_PER_DAY = 10;

type ConnectionRow = {
  encrypted_api_key: string;
  starforce_discount_rate: number;
  last_synced_at: string | null;
};

type EquipmentLevelRow = {
  name: string;
  level: number | null;
};

type NexonStarforceResponse = {
  starforce_history?: NexonStarforceHistory[];
  next_cursor?: string | null;
};

function addDays(date: string, amount: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function getKstDate(value = new Date()) {
  return new Date(value.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function enumerateDates(start: string, end: string) {
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end && dates.length < MAX_SYNC_DAYS) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function inferKnownItemLevel(itemName: string, exactLevels: Map<string, number>) {
  const exact = exactLevels.get(itemName);
  if (exact) return exact;

  const prefixLevels: Array<[string, number]> = [
    ['에테르넬', 250],
    ['아케인셰이드', 200],
    ['앱솔랩스', 160],
    ['파프니르', 150],
    ['하이네스', 150],
    ['이글아이', 150],
    ['트릭스터', 150],
  ];
  return prefixLevels.find(([prefix]) => itemName.startsWith(prefix))?.[1] ?? null;
}

async function fetchStarforceDate(apiKey: string, date: string) {
  const rows: NexonStarforceHistory[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES_PER_DAY; page += 1) {
    const params = new URLSearchParams({ count: String(PAGE_SIZE) });
    if (cursor) params.set('cursor', cursor);
    else params.set('date', date);

    const response = await fetch(`${NEXON_STARFORCE_URL}?${params.toString()}`, {
      headers: { 'x-nxopen-api-key': apiKey },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const message =
        response.status === 429
          ? '넥슨 API 요청 한도를 초과했어요. 잠시 후 다시 시도해 주세요.'
          : response.status === 403
            ? '넥슨 API 키 권한을 확인해 주세요.'
            : '넥슨에서 스타포스 이력을 불러오지 못했어요.';
      throw new Error(message);
    }

    const payload = (await response.json()) as NexonStarforceResponse;
    if (Array.isArray(payload.starforce_history)) rows.push(...payload.starforce_history);
    cursor = typeof payload.next_cursor === 'string' && payload.next_cursor ? payload.next_cursor : null;
    if (!cursor) break;
  }

  return rows;
}

async function loadExistingHistoryIds(
  db: ReturnType<typeof supabaseAdmin>,
  userId: string,
  ids: string[],
) {
  const existing = new Set<string>();
  for (const idChunk of chunk(ids, 200)) {
    const { data, error } = await db
      .from('nexon_enhancement_sync_records')
      .select('nexon_history_id')
      .eq('user_id', userId)
      .eq('history_type', 'starforce')
      .eq('calculation_status', 'calculated')
      .in('nexon_history_id', idChunk);
    if (error) throw error;
    for (const row of data ?? []) existing.add(row.nexon_history_id);
  }
  return existing;
}

async function loadEquipmentLevels(
  db: ReturnType<typeof supabaseAdmin>,
  itemNames: string[],
) {
  const levels = new Map<string, number>();
  for (const nameChunk of chunk(itemNames, 100)) {
    const { data, error } = await db
      .from('equipment_catalog')
      .select('name, level')
      .in('name', nameChunk);
    if (error) throw error;
    for (const row of (data ?? []) as EquipmentLevelRow[]) {
      if (row.level) levels.set(row.name, row.level);
    }
  }
  return levels;
}

function syncRecordPayload(
  userId: string,
  history: NexonStarforceHistory,
  status: string,
  calculated?: CalculatedStarforceHistory,
  expenseId?: string | null,
) {
  const occurredAt =
    calculated?.occurredAt ??
    (typeof history.date_create === 'string' ? history.date_create : new Date().toISOString());
  return {
    user_id: userId,
    history_type: 'starforce',
    nexon_history_id: calculated?.historyId ?? String(history.id ?? crypto.randomUUID()),
    expense_id: expenseId ?? null,
    occurred_at: occurredAt,
    character_name:
      calculated?.characterName ??
      (typeof history.character_name === 'string' ? history.character_name : '캐릭터 미상'),
    world_name:
      calculated?.worldName ??
      (typeof history.world_name === 'string' ? history.world_name : null),
    target_item:
      calculated?.targetItem ??
      (typeof history.target_item === 'string' ? history.target_item : '장비 미상'),
    item_level: calculated?.itemLevel ?? null,
    before_starforce:
      calculated?.beforeStarforce ??
      (Number.isFinite(Number(history.before_starforce_count))
        ? Number(history.before_starforce_count)
        : null),
    after_starforce:
      calculated?.afterStarforce ??
      (Number.isFinite(Number(history.after_starforce_count))
        ? Number(history.after_starforce_count)
        : null),
    result:
      calculated?.result ??
      (typeof history.item_upgrade_result === 'string' ? history.item_upgrade_result : null),
    calculated_amount: calculated?.amount ?? 0,
    calculation_status: status,
  };
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const userId = session.user.id;
  const db = supabaseAdmin();
  const { data: connectionData, error: connectionError } = await db
    .from('nexon_api_connections')
    .select('encrypted_api_key, starforce_discount_rate, last_synced_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (connectionError) {
    const status = connectionError.code === '42P01' || connectionError.code === 'PGRST205' ? 503 : 500;
    return NextResponse.json(
      {
        error:
          status === 503
            ? '넥슨 연동용 DB 설정이 필요합니다. supabase_create_nexon_enhancement_sync.sql을 실행해 주세요.'
            : '넥슨 연결 정보를 불러오지 못했어요.',
      },
      { status },
    );
  }
  if (!connectionData) {
    return NextResponse.json({ error: '설정에서 넥슨 API 키를 먼저 연결해 주세요.' }, { status: 409 });
  }

  try {
    const connection = connectionData as ConnectionRow;
    const apiKey = decryptNexonApiKey(connection.encrypted_api_key);
    const today = getKstDate();
    const defaultStart = addDays(today, -(INITIAL_SYNC_DAYS - 1));
    const lastSyncStart = connection.last_synced_at
      ? addDays(getKstDate(new Date(connection.last_synced_at)), -1)
      : defaultStart;
    const minimumStart = addDays(today, -(MAX_SYNC_DAYS - 1));
    const startDate = lastSyncStart < minimumStart ? minimumStart : lastSyncStart;
    const dates = enumerateDates(startDate, today);

    const fetchedRows = (await Promise.all(dates.map((date) => fetchStarforceDate(apiKey, date)))).flat();
    const validIds = fetchedRows
      .map((row) => (typeof row.id === 'string' ? row.id : ''))
      .filter(Boolean);
    const existingIds = await loadExistingHistoryIds(db, userId, validIds);
    const newRows = fetchedRows.filter(
      (row) => typeof row.id !== 'string' || !existingIds.has(row.id),
    );

    const targetItems = Array.from(
      new Set(
        newRows
          .map((row) => (typeof row.target_item === 'string' ? row.target_item : ''))
          .filter(Boolean),
      ),
    );
    const exactLevels = await loadEquipmentLevels(db, targetItems);
    const calculated: Array<{ raw: NexonStarforceHistory; value: CalculatedStarforceHistory }> = [];
    const skipped: Array<{ raw: NexonStarforceHistory; reason: StarforceSkipReason }> = [];

    for (const row of newRows) {
      const targetItem = typeof row.target_item === 'string' ? row.target_item : '';
      const result = calculateStarforceHistory(
        row,
        inferKnownItemLevel(targetItem, exactLevels),
        connection.starforce_discount_rate,
      );
      if (result.status === 'calculated') calculated.push({ raw: row, value: result.value });
      else skipped.push({ raw: row, reason: result.reason });
    }

    const groups = new Map<
      string,
      Array<{ raw: NexonStarforceHistory; value: CalculatedStarforceHistory }>
    >();
    for (const entry of calculated) {
      const key = [entry.value.date, entry.value.characterName, entry.value.targetItem].join('\u0000');
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }

    let importedExpenses = 0;
    let importedAttempts = 0;
    let totalAmount = 0;

    for (const entries of groups.values()) {
      const first = entries[0].value;
      const amount = entries.reduce((sum, entry) => sum + entry.value.amount, 0);
      const minStar = Math.min(...entries.map((entry) => entry.value.beforeStarforce));
      const maxStar = Math.max(...entries.map((entry) => entry.value.afterStarforce));
      const { data: expense, error: expenseError } = await db
        .from('expenses')
        .insert({
          user_id: userId,
          date: first.date,
          title: `${first.targetItem} 스타포스 강화`,
          amount,
          category: '강화',
          memo: `넥슨 API 계산 · ${first.characterName} · ${entries.length}회 · ${minStar}→${maxStar}성 · 실제 차감액이 아닌 계산값`,
          sync_status: 'synced',
          created_at: first.occurredAt,
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (expenseError || !expense) throw expenseError ?? new Error('강화 지출 저장 실패');

      const { error: recordsError } = await db
        .from('nexon_enhancement_sync_records')
        .upsert(
          entries.map((entry) => syncRecordPayload(userId, entry.raw, 'calculated', entry.value, expense.id)),
          { onConflict: 'user_id,history_type,nexon_history_id' },
        );
      if (recordsError) {
        await db.from('expenses').delete().eq('id', expense.id).eq('user_id', userId);
        throw recordsError;
      }

      importedExpenses += 1;
      importedAttempts += entries.length;
      totalAmount += amount;
    }

    if (skipped.length > 0) {
      const { error: skippedError } = await db
        .from('nexon_enhancement_sync_records')
        .upsert(
          skipped.map((entry) => syncRecordPayload(userId, entry.raw, entry.reason)),
          { onConflict: 'user_id,history_type,nexon_history_id', ignoreDuplicates: true },
        );
      if (skippedError) throw skippedError;
    }

    const lastSyncedAt = new Date().toISOString();
    const { error: updateError } = await db
      .from('nexon_api_connections')
      .update({ last_synced_at: lastSyncedAt, updated_at: lastSyncedAt })
      .eq('user_id', userId);
    if (updateError) throw updateError;

    const skippedByReason = skipped.reduce<Record<string, number>>((counts, entry) => {
      counts[entry.reason] = (counts[entry.reason] ?? 0) + 1;
      return counts;
    }, {});

    return NextResponse.json({
      importedExpenses,
      importedAttempts,
      totalAmount,
      skippedCount: skipped.length,
      skippedByReason,
      fetchedCount: fetchedRows.length,
      lastSyncedAt,
    });
  } catch (error) {
    console.error('NEXON Starforce sync failed', {
      userId,
      message: error instanceof Error ? error.message : 'unknown error',
    });
    const message =
      error instanceof Error &&
      (error.message.includes('넥슨') || error.message.includes('API'))
        ? error.message
        : '스타포스 강화비 동기화 중 오류가 발생했어요.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
