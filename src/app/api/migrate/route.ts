import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/../auth';
import { supabaseAdmin } from '@/shared/lib/supabase';
import type { Expense, Goal, Record as DiaryRecord, RecordWithCalculations } from '@/shared/types';

type MigratableRecord = DiaryRecord & Partial<
  Pick<
    RecordWithCalculations,
    'shard_value' | 'total_revenue' | 'net_revenue' | 'meso_per_hour' | 'net_per_hour' | 'shard_per_hour'
  >
>;

interface MigratePayload {
  records?: MigratableRecord[];
  goals?: Goal[];
  expenses?: Expense[];
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { records, goals, expenses } = (await req.json()) as MigratePayload;
  const safeRecords = Array.isArray(records) ? records : [];
  const safeGoals = Array.isArray(goals) ? goals : [];
  const safeExpenses = Array.isArray(expenses) ? expenses : [];
  const db = supabaseAdmin();
  const userId = session.user.id;

  // records 마이그레이션
  if (safeRecords.length > 0) {
    const rows = safeRecords.map((r) => ({
      id: r.id,
      user_id: userId,
      date: r.date,
      time_minutes: r.time_minutes,
      meso: r.meso,
      shard_count: r.shard_count ?? 0,
      material_cost: r.material_cost ?? 0,
      shard_value: r.shard_value ?? 0,
      total_revenue: r.total_revenue ?? 0,
      net_revenue: r.net_revenue ?? 0,
      meso_per_hour: r.meso_per_hour ?? 0,
      net_per_hour: r.net_per_hour ?? 0,
      shard_per_hour: r.shard_per_hour ?? 0,
      memo: r.memo ?? null,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    const { error } = await db
      .from('records')
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      console.error('records migrate error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // goals 마이그레이션
  if (safeGoals.length > 0) {
    const rows = safeGoals.map((g) => ({
      id: g.id,
      user_id: userId,
      position: g.position ?? 0,
      meso_goal: g.meso_goal ?? null,
      shard_goal: g.shard_goal ?? null,
      time_goal_minutes: g.time_goal_minutes ?? null,
      targets: g.targets ?? null,
      created_at: g.created_at,
      updated_at: g.updated_at,
    }));

    const { error } = await db
      .from('goals')
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      console.error('goals migrate error:', error);
    }
  }

  if (safeExpenses.length > 0) {
    const rows = safeExpenses.map((expense) => ({
      id: expense.id,
      user_id: userId,
      local_owner_id: expense.local_owner_id ?? null,
      date: expense.date,
      title: expense.title,
      amount: expense.amount ?? 0,
      category: expense.category ?? null,
      memo: expense.memo ?? null,
      sync_status: expense.sync_status ?? 'local',
      local_id: expense.local_id ?? null,
      created_at: expense.created_at,
      updated_at: expense.updated_at,
    }));

    const { error } = await db
      .from('expenses')
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      console.error('expenses migrate error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, migratedRecords: safeRecords.length, migratedExpenses: safeExpenses.length });
}
