import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/../auth';
import { supabaseAdmin } from '@/shared/lib/supabase';
import {
  calculateBaseStarforceCost,
  calculateStarforceAmount,
  roundToHundred,
} from '@/shared/lib/server/starforce-cost';

type SyncRecord = {
  id: string;
  item_level: number | null;
  before_starforce: number | null;
  calculated_amount: number;
  base_amount: number | null;
  event_discount_rate: number | null;
  personal_discount_rate: number | null;
  protection_surcharge: number | null;
  pc_room_discount_applied: boolean;
};

function calculateLegacyAmount(record: SyncRecord, applied: boolean) {
  const baseCost = calculateBaseStarforceCost(
    Number(record.item_level),
    Number(record.before_starforce),
  );
  if (baseCost === null) return null;
  if (Number(record.before_starforce) > 16) return Number(record.calculated_amount);

  const pcDiscount = roundToHundred(baseCost * 0.05);
  return applied
    ? Math.max(0, Number(record.calculated_amount) - pcDiscount)
    : Number(record.calculated_amount) + pcDiscount;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ expenseId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { expenseId } = await params;
  const body = (await request.json().catch(() => null)) as { applied?: unknown } | null;
  if (typeof body?.applied !== 'boolean') {
    return NextResponse.json({ error: 'PC방 할인 적용 여부가 필요합니다.' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('nexon_enhancement_sync_records')
    .select(
      'id,item_level,before_starforce,calculated_amount,base_amount,event_discount_rate,personal_discount_rate,protection_surcharge,pc_room_discount_applied',
    )
    .eq('user_id', session.user.id)
    .eq('expense_id', expenseId)
    .eq('history_type', 'starforce')
    .eq('calculation_status', 'calculated');

  if (error) {
    const needsMigration = error.code === '42703' || error.code === 'PGRST204';
    return NextResponse.json(
      {
        error: needsMigration
          ? 'PC방 할인용 DB 설정이 필요합니다. 최신 넥슨 연동 SQL을 실행해 주세요.'
          : '연동된 강화 기록을 불러오지 못했어요.',
      },
      { status: needsMigration ? 503 : 500 },
    );
  }
  if (!data?.length) {
    return NextResponse.json({ error: 'PC방 할인을 적용할 스타포스 기록이 없어요.' }, { status: 404 });
  }

  const records = data as SyncRecord[];
  const eligibleRecords = records.filter((record) => {
    const beforeStarforce = Number(record.before_starforce);
    return Number.isInteger(beforeStarforce) && beforeStarforce >= 0 && beforeStarforce <= 16;
  });
  if (eligibleRecords.length === 0) {
    return NextResponse.json(
      { error: '이 지출에는 PC방 할인 대상인 1~17성 강화 기록이 없어요.' },
      { status: 422 },
    );
  }

  const changed: Array<{ id: string; amount: number }> = [];
  for (const record of records) {
    if (record.pc_room_discount_applied === body.applied) {
      changed.push({ id: record.id, amount: Number(record.calculated_amount) });
      continue;
    }

    const hasExactBasis =
      record.base_amount !== null &&
      record.event_discount_rate !== null &&
      record.personal_discount_rate !== null &&
      record.protection_surcharge !== null;
    const amount = hasExactBasis
      ? calculateStarforceAmount({
          baseCost: Number(record.base_amount),
          beforeStarforce: Number(record.before_starforce),
          eventDiscountRate: Number(record.event_discount_rate),
          personalDiscountRate: Number(record.personal_discount_rate),
          pcRoomDiscountApplied: body.applied,
          destroyDefence: Number(record.protection_surcharge) > 0,
        })
      : calculateLegacyAmount(record, body.applied);
    if (amount === null) {
      return NextResponse.json(
        { error: '이 강화 기록은 비용 근거가 부족해 PC방 할인을 다시 계산할 수 없어요.' },
        { status: 422 },
      );
    }
    changed.push({ id: record.id, amount });
  }

  const previous = records.map((record) => ({
    id: record.id,
    amount: Number(record.calculated_amount),
    applied: record.pc_room_discount_applied,
  }));
  for (const record of changed) {
    const { error: updateError } = await db
      .from('nexon_enhancement_sync_records')
      .update({
        calculated_amount: record.amount,
        pc_room_discount_applied: body.applied,
      })
      .eq('id', record.id)
      .eq('user_id', session.user.id);
    if (updateError) {
      for (const rollback of previous) {
        await db
          .from('nexon_enhancement_sync_records')
          .update({ calculated_amount: rollback.amount, pc_room_discount_applied: rollback.applied })
          .eq('id', rollback.id)
          .eq('user_id', session.user.id);
      }
      return NextResponse.json({ error: 'PC방 할인 정보를 저장하지 못했어요.' }, { status: 500 });
    }
  }

  const amount = changed.reduce((sum, record) => sum + record.amount, 0);
  const { data: expense, error: expenseError } = await db
    .from('expenses')
    .update({ amount, updated_at: new Date().toISOString() })
    .eq('id', expenseId)
    .eq('user_id', session.user.id)
    .select()
    .single();
  if (expenseError || !expense) {
    for (const rollback of previous) {
      await db
        .from('nexon_enhancement_sync_records')
        .update({ calculated_amount: rollback.amount, pc_room_discount_applied: rollback.applied })
        .eq('id', rollback.id)
        .eq('user_id', session.user.id);
    }
    return NextResponse.json({ error: '지출 금액을 갱신하지 못했어요.' }, { status: 500 });
  }

  return NextResponse.json({ expense, pcRoomDiscountApplied: body.applied });
}
