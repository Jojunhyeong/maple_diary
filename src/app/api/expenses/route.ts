import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/../auth';
import { supabaseAdmin } from '@/shared/lib/supabase';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('expenses')
    .select('*')
    .eq('user_id', session.user.id)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const expenseIds = (data ?? []).map((expense) => expense.id);
  const syncByExpense = new Map<
    string,
    { historyType: string; pcRoomDiscountApplied: boolean; pcRoomDiscountEligible: boolean }
  >();
  if (expenseIds.length > 0) {
    const { data: syncRecords, error: syncError } = await db
      .from('nexon_enhancement_sync_records')
      .select('expense_id,history_type,before_starforce,pc_room_discount_applied')
      .eq('user_id', session.user.id)
      .in('expense_id', expenseIds);

    // 배포 순서상 연동 테이블/신규 컬럼이 아직 없어도 기존 지출 목록은 정상 제공됩니다.
    if (!syncError) {
      for (const record of syncRecords ?? []) {
        if (!record.expense_id) continue;
        const current = syncByExpense.get(record.expense_id);
        const beforeStarforce = Number(record.before_starforce);
        const eligible =
          record.history_type === 'starforce' &&
          Number.isInteger(beforeStarforce) &&
          beforeStarforce >= 0 &&
          beforeStarforce <= 16;
        syncByExpense.set(record.expense_id, {
          historyType: record.history_type,
          pcRoomDiscountApplied:
            !!record.pc_room_discount_applied || !!current?.pcRoomDiscountApplied,
          pcRoomDiscountEligible: eligible || !!current?.pcRoomDiscountEligible,
        });
      }
    }
  }

  return NextResponse.json(
    (data ?? []).map((expense) => {
      const sync = syncByExpense.get(expense.id);
      return sync
        ? {
            ...expense,
            nexon_history_type: sync.historyType,
            pc_room_discount_applied: sync.pcRoomDiscountApplied,
            pc_room_discount_eligible: sync.pcRoomDiscountEligible,
          }
        : expense;
    }),
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const db = supabaseAdmin();

  const { data, error } = await db
    .from('expenses')
    .insert({ ...body, user_id: session.user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
